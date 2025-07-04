import frappe
from frappe.utils import get_datetime, add_to_date, now_datetime, time_diff_in_hours
from frappe.utils import get_datetime
from frappe.utils import time_diff_in_hours
import hashlib

@frappe.whitelist()
def get_scheduled_work_orders():
    """Get Work Orders for calendar display - keeping existing functionality"""
    work_orders = frappe.get_all("Work Order", filters={"docstatus": ["<", 2]},
        fields=["name", "planned_start_date", "planned_end_date", "production_item", "qty", "expected_delivery_date"])
    events = []
    for wo in work_orders:
        events.append({
            "id": wo.name,
            "title": wo.production_item,
            "start": wo.planned_start_date,
            "end": wo.planned_end_date,
            "extendedProps": {
                "qty": wo.qty,
                "delivery": wo.expected_delivery_date,
                "type": "work_order"
            },
            "className": "work-order-event"
        })
    return events

@frappe.whitelist()
def get_job_cards_with_workstations():
    """Get Job Cards (Operations) with workstation information for resource-based calendar view"""
    
    # Debug: Let's see what job cards exist
    debug_query = """
        SELECT 
            jc.name,
            jc.operation,
            jc.workstation,
            jc.expected_start_date,
            jc.expected_end_date,
            jc.status,
            jc.work_order,
            jc.docstatus
        FROM `tabJob Card` jc
        ORDER BY jc.creation DESC
        LIMIT 10
    """
    debug_results = frappe.db.sql(debug_query, as_dict=True)
    print(f"DEBUG: Found {len(debug_results)} total job cards")
    for jc in debug_results:
        print(f"  - {jc.name}: {jc.operation}, WS: {jc.workstation}, Status: {jc.docstatus}, Dates: {jc.expected_start_date} to {jc.expected_end_date}")
    
    job_cards = frappe.db.sql("""
        SELECT 
            jc.name,
            jc.operation,
            jc.workstation,
            jc.expected_start_date,
            jc.expected_end_date,
            jc.actual_start_date,
            jc.actual_end_date,
            jc.status,
            jc.work_order,
            jc.total_completed_qty,
            jc.for_quantity,
            jc.operation_id,
            jc.sequence_id,
            wo.production_item,
            wo.qty as work_order_qty,
            wo.planned_start_date as wo_start,
            wo.planned_end_date as wo_end,
            ws.workstation_type,
            ws.workstation_name
        FROM `tabJob Card` jc
        LEFT JOIN `tabWork Order` wo ON jc.work_order = wo.name
        LEFT JOIN `tabWorkstation` ws ON jc.workstation = ws.name
        WHERE jc.docstatus < 2
        AND jc.expected_start_date IS NOT NULL
        AND jc.expected_end_date IS NOT NULL
        ORDER BY jc.work_order, jc.sequence_id, jc.expected_start_date
    """, as_dict=True)
    
    print(f"DEBUG: Found {len(job_cards)} scheduled job cards")
    
    events = []
    for jc in job_cards:
        # Determine color based on status
        color = get_job_card_color(jc.status)
        
        # Smart date selection: use actual for completed, expected for planning
        if jc.status in ['Completed', 'Cancelled']:
            # For completed operations, show actual times (read-only for history)
            start_date = jc.actual_start_date or jc.expected_start_date
            end_date = jc.actual_end_date or jc.expected_end_date
            is_editable = False  # Completed operations shouldn't be rescheduled
        else:
            # For ongoing/future operations, show expected times (editable for planning)
            start_date = jc.expected_start_date
            end_date = jc.expected_end_date  
            is_editable = True
        
        # Create title showing actual job card name and operation
        title = f"{jc.name}: {jc.operation}"  # Use actual job card name
        sequence = f"Op{jc.sequence_id or jc.operation_id or '?'}"
        
        events.append({
            "id": jc.name,
            "title": title,
            "start": start_date,
            "end": end_date,
            "resourceId": jc.workstation,
            "backgroundColor": color,
            "borderColor": get_work_order_border_color(jc.work_order),
            "borderWidth": "3px",  # Thick border to show work order relationship
            "editable": is_editable,  # Control draggability based on status
            "extendedProps": {
                "type": "operation",
                "job_card_name": jc.name,  # Add actual job card name
                "operation": jc.operation,
                "sequence": sequence,
                "workstation": jc.workstation,
                "workstation_type": jc.workstation_type,
                "work_order": jc.work_order,
                "production_item": jc.production_item,
                "status": jc.status,
                "completed_qty": jc.total_completed_qty,
                "for_quantity": jc.for_quantity,
                "work_order_qty": jc.work_order_qty,
                "wo_start": jc.wo_start,
                "wo_end": jc.wo_end,
                "is_editable": is_editable,
                "display_mode": "completed" if not is_editable else "planning"
            }
        })
    
    print(f"DEBUG: Returning {len(events)} operation events")
    return events

@frappe.whitelist()
def get_workstations_resources():
    """Get workstations grouped by type for calendar resource view"""
    workstations = frappe.db.sql("""
        SELECT 
            ws.name,
            ws.workstation_name,
            ws.workstation_type,
            ws.status,
            wst.name as workstation_type_name
        FROM `tabWorkstation` ws
        LEFT JOIN `tabWorkstation Type` wst ON ws.workstation_type = wst.name
        ORDER BY ws.workstation_type, ws.workstation_name
    """, as_dict=True)
    
    print(f"DEBUG: Found {len(workstations)} workstations")
    for ws in workstations:
        print(f"  - {ws.workstation_name} ({ws.name}): Type={ws.workstation_type}, Status={ws.status}")
    
    resources = []
    workstation_types = {}
    
    # Group workstations by type
    for ws in workstations:
        ws_type = ws.workstation_type or "Uncategorized"
        if ws_type not in workstation_types:
            workstation_types[ws_type] = []
        workstation_types[ws_type].append(ws)
    
    # Create resource structure for FullCalendar
    for ws_type, stations in workstation_types.items():
        # Add workstation type as parent resource
        resources.append({
            "id": f"type_{ws_type}",
            "title": ws_type,
            "children": []
        })
        
        # Add individual workstations as children
        for ws in stations:
            resources[-1]["children"].append({
                "id": ws.name,
                "title": ws.workstation_name,
                "extendedProps": {
                    "type": "workstation",
                    "workstation_type": ws.workstation_type,
                    "status": ws.status
                }
            })
    
    print(f"DEBUG: Created {len(resources)} resource groups")
    return resources

def get_job_card_color(status):
    """Return color based on job card status"""
    status_colors = {
        "Open": "#3498db",           # Blue
        "Work In Progress": "#f39c12", # Orange
        "Completed": "#27ae60",      # Green
        "Material Transferred": "#9b59b6", # Purple
        "On Hold": "#e74c3c",        # Red
        "Cancelled": "#95a5a6"       # Gray
    }
    return status_colors.get(status, "#34495e")  # Default dark gray

def get_work_order_border_color(work_order_name):
    """Generate consistent border color for work order to visually link operations"""
    # Create a simple hash-based color for consistent work order grouping
    hash_obj = hashlib.md5(work_order_name.encode())
    hash_hex = hash_obj.hexdigest()
    
    # Convert first 6 chars to RGB
    r = int(hash_hex[0:2], 16)
    g = int(hash_hex[2:4], 16) 
    b = int(hash_hex[4:6], 16)
    
    # Ensure colors are dark enough to be visible as borders
    r = max(r, 100)
    g = max(g, 100) 
    b = max(b, 100)
    
    return f"rgb({r},{g},{b})"

@frappe.whitelist()
def update_work_order_schedule(name, new_start, new_end):
    """Update Work Order schedule - keeping existing functionality"""
    wo = frappe.get_doc("Work Order", name)
    wo.planned_start_date = get_datetime(new_start.split("+")[0])
    wo.planned_end_date = get_datetime(new_end.split("+")[0])
    wo.save()
    shift_following_work_orders(wo.name)
    return "Updated"

@frappe.whitelist()
def update_job_card_schedule(name, new_start, new_end, new_workstation=None):
    """Update Job Card schedule and optionally workstation"""
    jc = frappe.get_doc("Job Card", name)
    
    # Allow rescheduling regardless of status for capacity planning
    # Store original status to restore if needed
    original_status = jc.status
    
    # Update dates
    jc.expected_start_date = get_datetime(new_start.split("+")[0])
    jc.expected_end_date = get_datetime(new_end.split("+")[0])
    
    # Update workstation if provided
    if new_workstation and new_workstation != jc.workstation:
        # Validate workstation exists and is active
        if frappe.db.exists("Workstation", new_workstation):
            jc.workstation = new_workstation
        else:
            frappe.throw(f"Workstation {new_workstation} does not exist or is inactive")
    
    # Validate no overlap with other job cards on same workstation
    # Skip validation for the same job card
    try:
        validate_job_card_overlap(jc)
    except Exception as e:
        # If validation fails, provide more helpful error message
        frappe.throw(f"Scheduling conflict: {str(e)}")
    
    # Save with ignore_permissions for capacity planning
    try:
        jc.save(ignore_permissions=True)
        return "Job Card Updated"
    except Exception as e:
        frappe.throw(f"Failed to update job card: {str(e)}")

def validate_job_card_overlap(job_card):
    """Validate that job card doesn't overlap with others on same workstation"""
    overlapping = frappe.db.sql("""
        SELECT name, operation FROM `tabJob Card`
        WHERE workstation = %s
        AND name != %s
        AND docstatus < 2
        AND expected_start_date IS NOT NULL
        AND expected_end_date IS NOT NULL
        AND (
            (expected_start_date <= %s AND expected_end_date > %s)
            OR (expected_start_date < %s AND expected_end_date >= %s)
            OR (expected_start_date >= %s AND expected_start_date < %s)
        )
    """, (
        job_card.workstation,
        job_card.name,
        job_card.expected_start_date, job_card.expected_start_date,
        job_card.expected_end_date, job_card.expected_end_date,
        job_card.expected_start_date, job_card.expected_end_date
    ), as_dict=True)
    
    if overlapping:
        overlap_names = [f"{ov.operation} ({ov.name})" for ov in overlapping]
        frappe.throw(f"Job Card overlaps with: {', '.join(overlap_names)} on workstation {job_card.workstation}")

def shift_following_work_orders(current_name):
    """Shift following work orders - keeping existing functionality"""
    current = frappe.get_doc("Work Order", current_name)
    
    others = frappe.get_all("Work Order",
        filters={
            "docstatus": ["<", 2],
            "planned_start_date": [">=", current.planned_start_date],
            "name": ["!=", current.name]
        },
        order_by="planned_start_date asc",
        fields=["name", "planned_start_date", "planned_end_date"]
    )
    
    prev_end = current.planned_end_date
    
    for wo in others:
        wo_doc = frappe.get_doc("Work Order", wo.name)
        duration = time_diff_in_hours(wo_doc.planned_end_date, wo_doc.planned_start_date)
        
        if get_datetime(wo_doc.planned_start_date) < prev_end:
            wo_doc.planned_start_date = prev_end
            wo_doc.planned_end_date = add_to_date(prev_end, hours=duration)
            wo_doc.save()
            
        prev_end = wo_doc.planned_end_date

@frappe.whitelist()
def auto_schedule_new_work_order(work_order_name):
    """Auto schedule work order - keeping existing functionality"""
    from frappe.utils import now_datetime, add_to_date, get_datetime
    
    wo = frappe.get_doc("Work Order", work_order_name)
    
    if wo.planned_start_date and wo.planned_end_date:
        return wo.name
    
    lead_mins = wo.lead_time or 60
    duration_hours = lead_mins / 60.0
    delivery_deadline = get_datetime(wo.expected_delivery_date) if wo.expected_delivery_date else add_to_date(now_datetime(), days=7)
    
    print(f"DEBUG: Scheduling Work Order: {work_order_name}")
    print(f"DEBUG: Lead time: {lead_mins} minutes ({duration_hours} hours)")
    print(f"DEBUG: Delivery deadline: {delivery_deadline}")
    
    existing = frappe.get_all(
        "Work Order",
        filters={
            "docstatus": ["<", 2],
            "name": ["!=", wo.name],
            "planned_start_date": ["is", "set"],
            "planned_end_date": ["is", "set"]
        },
        order_by="planned_start_date asc",
        fields=["name", "planned_start_date", "planned_end_date"]
    )
    
    print(f"DEBUG: Found {len(existing)} existing work orders")
    
    if not existing:
        wo.planned_start_date = now_datetime()
        wo.planned_end_date = add_to_date(wo.planned_start_date, minutes=lead_mins)
        wo.save()
        print(f"DEBUG: No existing WOs, scheduled from now")
        return wo.name
    
    current_time = now_datetime()
    found_slot = False
    
    print(f"DEBUG: Current time: {current_time}")
    
    if existing and get_datetime(existing[0].planned_start_date) > current_time:
        gap_duration = time_diff_in_hours(existing[0].planned_start_date, current_time)
        print(f"DEBUG: Gap before first WO: {gap_duration} hours")
        if gap_duration >= duration_hours:
            wo.planned_start_date = current_time
            wo.planned_end_date = add_to_date(current_time, minutes=lead_mins)
            found_slot = True
            print(f"DEBUG: Found slot before first WO")
    
    if not found_slot:
        print(f"DEBUG: Checking gaps between {len(existing)} work orders")
        for i in range(len(existing) - 1):
            current_end = get_datetime(existing[i].planned_end_date)
            next_start = get_datetime(existing[i + 1].planned_start_date)
            gap_duration = time_diff_in_hours(next_start, current_end)
            
            print(f"DEBUG: Gap between WO {i} and WO {i+1}: {gap_duration} hours")
            
            if gap_duration >= duration_hours:
                wo.planned_start_date = current_end
                wo.planned_end_date = add_to_date(current_end, minutes=lead_mins)
                found_slot = True
                print(f"DEBUG: Found suitable gap! Scheduled from {current_end} to {wo.planned_end_date}")
                break
    
    if not found_slot:
        last_end = get_datetime(existing[-1].planned_end_date)
        wo.planned_start_date = last_end
        wo.planned_end_date = add_to_date(last_end, minutes=lead_mins)
        print(f"DEBUG: No gaps found, scheduled after last WO: {last_end} to {wo.planned_end_date}")
    
    print(f"DEBUG: Final schedule: {wo.planned_start_date} to {wo.planned_end_date}")
    
    if wo.planned_end_date > delivery_deadline:
        print(f"DEBUG: EXCEEDING DEADLINE! Planned end: {wo.planned_end_date}, Deadline: {delivery_deadline}")
        frappe.throw("Cannot auto-schedule: no slot available before expected delivery date.")
    
    wo.save()
    print(f"DEBUG: Work Order saved successfully")
    
    return wo.name

@frappe.whitelist()
def auto_schedule_job_cards_for_work_order(work_order_name):
    """Auto schedule job cards when work order is scheduled"""
    wo = frappe.get_doc("Work Order", work_order_name)
    
    if not wo.planned_start_date or not wo.planned_end_date:
        frappe.throw("Work Order must be scheduled before scheduling Job Cards")
    
    # Get job cards for this work order
    job_cards = frappe.get_all("Job Card",
        filters={
            "work_order": work_order_name,
            "docstatus": ["<", 2]
        },
        fields=["name", "operation", "workstation", "time_required", "operation_id"],
        order_by="operation_id asc"
    )
    
    if not job_cards:
        return "No Job Cards found"
    
    current_start = wo.planned_start_date
    
    for jc_data in job_cards:
        jc = frappe.get_doc("Job Card", jc_data.name)
        
        # Calculate duration (time_required is in minutes)
        duration_mins = jc.time_required or 60
        
        # Find available slot for this workstation
        available_start = find_available_workstation_slot(
            jc.workstation, 
            current_start, 
            duration_mins
        )
        
        jc.expected_start_date = available_start
        jc.expected_end_date = add_to_date(available_start, minutes=duration_mins)
        jc.save()
        
        # Next job card should start after this one
        current_start = jc.expected_end_date
    
    return f"Scheduled {len(job_cards)} Job Cards"

def find_available_workstation_slot(workstation, preferred_start, duration_mins):
    """Find next available slot for workstation"""
    # Get existing job cards for this workstation
    existing = frappe.get_all("Job Card",
        filters={
            "workstation": workstation,
            "docstatus": ["<", 2],
            "expected_start_date": ["is", "set"],
            "expected_end_date": ["is", "set"]
        },
        fields=["expected_start_date", "expected_end_date"],
        order_by="expected_start_date asc"
    )
    
    if not existing:
        return preferred_start
    
    duration_hours = duration_mins / 60.0
    current_time = get_datetime(preferred_start)
    
    # Check if we can start at preferred time
    first_conflict = None
    for jc in existing:
        if (get_datetime(jc.expected_start_date) <= current_time < get_datetime(jc.expected_end_date)):
            first_conflict = jc
            break
    
    if not first_conflict:
        # Check gaps between existing job cards
        for i in range(len(existing) - 1):
            current_end = get_datetime(existing[i].expected_end_date)
            next_start = get_datetime(existing[i + 1].expected_start_date)
            
            if current_end >= current_time:
                gap_duration = time_diff_in_hours(next_start, current_end)
                if gap_duration >= duration_hours:
                    return max(current_time, current_end)
        
        # Schedule after last job card
        return max(current_time, get_datetime(existing[-1].expected_end_date))
    else:
        # Schedule after conflicting job card
        return get_datetime(first_conflict.expected_end_date)

@frappe.whitelist()
def create_test_job_cards():
    """Create test job cards for demo purposes"""
    from frappe.utils import now_datetime, add_to_date
    
    # Get submitted work orders without job cards
    work_orders = frappe.get_all("Work Order", 
        filters={"docstatus": 1}, 
        fields=["name", "production_item", "planned_start_date", "planned_end_date"]
    )
    
    created_count = 0
    for wo in work_orders:
        # Check if job cards already exist
        existing_job_cards = frappe.get_all("Job Card", filters={"work_order": wo.name})
        if existing_job_cards:
            continue
            
        # Get workstations
        workstations = frappe.get_all("Workstation", fields=["name"], limit=3)
        if not workstations:
            continue
            
        # Create 3 sample operations
        operations = [
            {"operation": "Cutting", "time_required": 60},
            {"operation": "Assembly", "time_required": 45}, 
            {"operation": "Quality Check", "time_required": 30}
        ]
        
        start_time = wo.planned_start_date or now_datetime()
        
        for i, op in enumerate(operations):
            job_card = frappe.new_doc("Job Card")
            job_card.work_order = wo.name
            job_card.operation = op["operation"]
            job_card.workstation = workstations[i % len(workstations)].name
            job_card.for_quantity = 10
            job_card.operation_id = i + 1
            job_card.sequence_id = i + 1
            job_card.expected_start_date = start_time
            job_card.expected_end_date = add_to_date(start_time, minutes=op["time_required"])
            job_card.time_required = op["time_required"]
            job_card.status = "Open"
            
            try:
                job_card.insert()
                created_count += 1
                start_time = job_card.expected_end_date
            except Exception as e:
                print(f"Error creating job card: {e}")
                continue
    
    return f"Created {created_count} test job cards"

@frappe.whitelist()
def get_workstation_utilization(start_date, end_date):
    """Get workstation utilization data for the given period"""
    utilization_data = frappe.db.sql("""
        SELECT 
            jc.workstation,
            ws.workstation_name,
            ws.workstation_type,
            COUNT(jc.name) as total_jobs,
            AVG(TIMESTAMPDIFF(MINUTE, jc.expected_start_date, jc.expected_end_date)) as avg_duration,
            SUM(TIMESTAMPDIFF(MINUTE, jc.expected_start_date, jc.expected_end_date)) as total_minutes,
            SUM(CASE WHEN jc.status = 'Completed' THEN 1 ELSE 0 END) as completed_jobs
        FROM `tabJob Card` jc
        LEFT JOIN `tabWorkstation` ws ON jc.workstation = ws.name
        WHERE jc.expected_start_date >= %s 
        AND jc.expected_end_date <= %s
        AND jc.docstatus < 2
        GROUP BY jc.workstation
        ORDER BY total_minutes DESC
    """, (start_date, end_date), as_dict=True)
    
    return utilization_data

@frappe.whitelist()
def create_bulk_test_work_orders(count=50):
    """Create bulk work orders for performance testing"""
    from frappe.utils import now_datetime, add_to_date
    import random
    
    created_count = 0
    base_time = now_datetime()
    
    for i in range(count):
        try:
            wo = frappe.new_doc("Work Order")
            wo.production_item = f"Test Item {i+1}"
            wo.qty = random.randint(5, 50)
            wo.company = frappe.defaults.get_user_default("Company")
            wo.expected_delivery_date = add_to_date(base_time, days=random.randint(1, 30))
            wo.lead_time = random.randint(30, 180)  # 30 minutes to 3 hours
            
            wo.insert()
            created_count += 1
            
        except Exception as e:
            print(f"Error creating work order {i+1}: {e}")
            continue
    
    return f"Created {created_count} test work orders for performance testing"