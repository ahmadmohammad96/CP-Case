import frappe
from frappe.utils import get_datetime, add_to_date, now_datetime, time_diff_in_hours
from frappe.utils import get_datetime
from frappe.utils import time_diff_in_hours



@frappe.whitelist()
def get_scheduled_work_orders():
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
                "delivery": wo.expected_delivery_date
            }
        })
    return events



@frappe.whitelist()
def update_work_order_schedule(name, new_start, new_end):
    wo = frappe.get_doc("Work Order", name)
    wo.planned_start_date = get_datetime(new_start.split("+")[0])
    wo.planned_end_date = get_datetime(new_end.split("+")[0])
    wo.save()
    shift_following_work_orders(wo.name)
    return "Updated"


def shift_following_work_orders(current_name):
    current = frappe.get_doc("Work Order", current_name)
    
    # Get all work orders that might be affected (starting at or after the current work order)
    others = frappe.get_all("Work Order",
        filters={
            "docstatus": ["<", 2],  # Both draft and submitted
            "planned_start_date": [">=", current.planned_start_date],
            "name": ["!=", current.name]  # Exclude current work order
        },
        order_by="planned_start_date asc",
        fields=["name", "planned_start_date", "planned_end_date"]
    )
    
    prev_end = current.planned_end_date
    
    for wo in others:
        wo_doc = frappe.get_doc("Work Order", wo.name)
        duration = time_diff_in_hours(wo_doc.planned_end_date, wo_doc.planned_start_date)
        
        # Check for overlap with previous work order
        if get_datetime(wo_doc.planned_start_date) < prev_end:
            # Calculate new start and end dates
            wo_doc.planned_start_date = prev_end
            wo_doc.planned_end_date = add_to_date(prev_end, hours=duration)
            wo_doc.save()
            
        # Update prev_end for next iteration
        prev_end = wo_doc.planned_end_date




@frappe.whitelist()
def auto_schedule_new_work_order(work_order_name):
    from frappe.utils import now_datetime, add_to_date, get_datetime
    
    wo = frappe.get_doc("Work Order", work_order_name)
    
    # If already scheduled, don't change it
    if wo.planned_start_date and wo.planned_end_date:
        return wo.name
    
    lead_mins = wo.lead_time or 60
    duration_hours = lead_mins / 60.0
    delivery_deadline = get_datetime(wo.expected_delivery_date) if wo.expected_delivery_date else add_to_date(now_datetime(), days=7)
    
    print(f"DEBUG: Scheduling Work Order: {work_order_name}")
    print(f"DEBUG: Lead time: {lead_mins} minutes ({duration_hours} hours)")
    print(f"DEBUG: Delivery deadline: {delivery_deadline}")
    
    # Get all scheduled work orders (both draft and submitted)
    existing = frappe.get_all(
        "Work Order",
        filters={
            "docstatus": ["<", 2],  # Include both draft and submitted
            "name": ["!=", wo.name],  # Exclude current work order
            "planned_start_date": ["is", "set"],
            "planned_end_date": ["is", "set"]
        },
        order_by="planned_start_date asc",
        fields=["name", "planned_start_date", "planned_end_date"]
    )
    
    print(f"DEBUG: Found {len(existing)} existing work orders")
    for i, existing_wo in enumerate(existing):
        print(f"DEBUG: WO {i}: {existing_wo.name} - Start: {existing_wo.planned_start_date}, End: {existing_wo.planned_end_date}")
    
    # If no existing work orders, schedule from now
    if not existing:
        wo.planned_start_date = now_datetime()
        wo.planned_end_date = add_to_date(wo.planned_start_date, minutes=lead_mins)
        wo.save()
        print(f"DEBUG: No existing WOs, scheduled from now")
        return wo.name
    
    # Try to find gaps between existing work orders
    current_time = now_datetime()
    found_slot = False
    
    print(f"DEBUG: Current time: {current_time}")
    
    # Check if there's space before the first work order
    if existing and get_datetime(existing[0].planned_start_date) > current_time:
        gap_duration = time_diff_in_hours(existing[0].planned_start_date, current_time)
        print(f"DEBUG: Gap before first WO: {gap_duration} hours")
        if gap_duration >= duration_hours:
            wo.planned_start_date = current_time
            wo.planned_end_date = add_to_date(current_time, minutes=lead_mins)
            found_slot = True
            print(f"DEBUG: Found slot before first WO")
    
    # Check for gaps between work orders
    if not found_slot:
        print(f"DEBUG: Checking gaps between {len(existing)} work orders")
        for i in range(len(existing) - 1):
            current_end = get_datetime(existing[i].planned_end_date)
            next_start = get_datetime(existing[i + 1].planned_start_date)
            gap_duration = time_diff_in_hours(next_start, current_end)
            
            print(f"DEBUG: Gap between WO {i} ({existing[i].name}) and WO {i+1} ({existing[i+1].name})")
            print(f"DEBUG: Current end: {current_end}")
            print(f"DEBUG: Next start: {next_start}")
            print(f"DEBUG: Gap duration: {gap_duration} hours")
            print(f"DEBUG: Required duration: {duration_hours} hours")
            
            if gap_duration >= duration_hours:
                wo.planned_start_date = current_end
                wo.planned_end_date = add_to_date(current_end, minutes=lead_mins)
                found_slot = True
                print(f"DEBUG: Found suitable gap! Scheduled from {current_end} to {wo.planned_end_date}")
                break
            else:
                print(f"DEBUG: Gap too small ({gap_duration} < {duration_hours})")
    
    # If no suitable gap found, schedule after the last work order
    if not found_slot:
        last_end = get_datetime(existing[-1].planned_end_date)
        wo.planned_start_date = last_end
        wo.planned_end_date = add_to_date(last_end, minutes=lead_mins)
        print(f"DEBUG: No gaps found, scheduled after last WO: {last_end} to {wo.planned_end_date}")
    
    print(f"DEBUG: Final schedule: {wo.planned_start_date} to {wo.planned_end_date}")
    print(f"DEBUG: Delivery deadline: {delivery_deadline}")
    
    # Check if we're exceeding delivery deadline
    if wo.planned_end_date > delivery_deadline:
        print(f"DEBUG: EXCEEDING DEADLINE! Planned end: {wo.planned_end_date}, Deadline: {delivery_deadline}")
        frappe.throw("Cannot auto-schedule: no slot available before expected delivery date.")
    
    wo.save()
    print(f"DEBUG: Work Order saved successfully")
    
    # No need to shift other work orders since we found a suitable slot
    return wo.name

