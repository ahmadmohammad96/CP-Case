frappe.pages['work_order_calendar'].on_page_load = async function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Work Order Calendar - Capacity Planning',
        single_column: true
    });

    await load_fullcalendar_assets();

    // Create comprehensive toolbar
    const toolbar = $(`
        <div class="calendar-toolbar" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                <button class="btn btn-primary btn-sm" id="work-order-view">Work Orders</button>
                <button class="btn btn-secondary btn-sm" id="operations-view">Operations & Workstations</button>
                <button class="btn btn-default btn-sm" id="utilization-view">Utilization</button>
                <div style="margin-left: auto; display: flex; gap: 5px;">
                    <input type="date" id="jump-to-date" class="form-control form-control-sm" style="width: 150px;" title="Jump to Date">
                    <button class="btn btn-sm btn-default" id="zoom-out" title="Zoom Out (Ctrl+Scroll)">🔍➖</button>
                    <button class="btn btn-sm btn-default" id="zoom-in" title="Zoom In (Ctrl+Scroll)">🔍➕</button>
                    <button class="btn btn-sm btn-success" id="refresh-btn" title="Refresh (Ctrl+R)">🔄</button>
                </div>
            </div>
            <div id="workstation-summary" style="display: none; font-size: 12px; color: #666;"></div>
            <div id="zoom-indicator" style="font-size: 11px; color: #888; margin-top: 5px;">
                Zoom: <span id="zoom-level">Normal</span> | Use Ctrl+Scroll for precision zoom
            </div>
        </div>
    `).appendTo(page.body);

    // Workstation sidebar for fallback mode
    const sidebarContainer = $(`
        <div style="display: flex; gap: 15px;">
            <div id="workstation-sidebar" style="width: 200px; display: none;">
                <div style="background: #f1f3f4; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                    <h6 style="margin: 0; color: #5e6c84;">Workstations</h6>
                </div>
                <div id="workstation-list"></div>
            </div>
            <div id="calendar-container" style="flex: 1;">
                <div id="calendar"></div>
            </div>
        </div>
    `).appendTo(page.body);

    const calendarDiv = $('#calendar');
    const sidebarDiv = $('#workstation-sidebar');

    // Create tooltip
    const tooltipEl = document.createElement("div");
    tooltipEl.style.cssText = `
        position: absolute; padding: 12px; background: #fff; border: 2px solid #ddd; 
        border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 1000; 
        display: none; max-width: 350px; font-size: 13px; line-height: 1.4;
    `;
    document.body.appendChild(tooltipEl);

    let calendar;
    let currentView = 'work_orders';
    let zoomLevel = 1;
    let workstationData = [];
    let refreshInterval;

    // Enhanced initialization
    function initializeCalendar(viewType = 'work_orders') {
        if (calendar) {
            calendar.destroy();
        }

        const slotDuration = getSlotDuration();
        const calendarConfig = {
            nowIndicator: true,
            editable: true,
            eventResizableFromStart: true,
            height: 'auto',
            aspectRatio: 1.8,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            slotMinTime: '05:00:00',
            slotMaxTime: '23:00:00',
            slotDuration: slotDuration,
            slotLabelInterval: slotDuration,
            snapDuration: slotDuration,
            scrollTime: '08:00:00',
            scrollTimeReset: false,
            allDaySlot: false,
            
            // Enhanced event rendering
            eventContent: function (arg) {
                const isOperation = arg.event.extendedProps.type === 'operation';
                const fontSize = Math.max(9, 12 * Math.sqrt(zoomLevel));
                
                if (isOperation) {
                    const jobCardName = arg.event.extendedProps.job_card_name || arg.event.id;
                    const op = arg.event.extendedProps.operation || '';
                    const ws = arg.event.extendedProps.workstation || '';
                    
                    return { 
                        html: `
                            <div style="padding: 2px; font-size: ${fontSize}px; overflow: hidden;">
                                <div style="font-weight: bold; margin-bottom: 1px;">${jobCardName}</div>
                                <div style="font-size: ${fontSize-1}px;">${op}</div>
                                <div style="font-size: ${fontSize-2}px; opacity: 0.8;">[${ws}]</div>
                            </div>
                        ` 
                    };
                } else {
                    return { 
                        html: `<div style="padding: 3px; font-size: ${fontSize}px; font-weight: bold;">${arg.event.title}</div>` 
                    };
                }
            },
            
            eventDidMount: function (info) {
                setupEnhancedTooltip(info);
                
                // Add visual work order linking
                if (info.event.extendedProps.type === 'operation') {
                    const workOrder = info.event.extendedProps.work_order;
                    info.el.setAttribute('data-work-order', workOrder);
                    info.el.setAttribute('data-workstation', info.event.extendedProps.workstation);
                    info.el.style.borderLeft = `5px solid ${info.event.borderColor}`;
                    
                    // Ensure all job cards are draggable regardless of status
                    info.event.setProp('editable', true);
                }
            },
            
            eventClick: function (info) {
                const isOperation = info.event.extendedProps.type === 'operation';
                if (isOperation) {
                    frappe.set_route("Form", "Job Card", info.event.id);
                } else {
                    frappe.set_route("Form", "Work Order", info.event.id);
                }
            },
            
            eventDrop: handleEventDrop,
            eventResize: handleEventResize
        };

        // Configure view-specific settings
        if (viewType === 'operations') {
            calendarConfig.initialView = 'timeGridWeek';
            calendarConfig.dayMaxEvents = false; // Show all events
            loadOperationsView();
            showWorkstationSidebar();
        } else {
            calendarConfig.initialView = 'timeGridWeek';
            loadWorkOrderView();
            hideWorkstationSidebar();
        }

        calendar = new FullCalendar.Calendar(calendarDiv[0], calendarConfig);
        calendar.render();

        // Enable horizontal scrolling
        enableHorizontalScrolling();
        
        // Add zoom control
        calendarDiv[0].addEventListener('wheel', handlePrecisionZoom, { passive: false });
        
        updateZoomIndicator();
    }

    function getSlotDuration() {
        if (zoomLevel >= 3) return '00:05:00';      // 5 minutes - ultra detailed
        if (zoomLevel >= 2) return '00:15:00';      // 15 minutes - detailed  
        if (zoomLevel >= 1.5) return '00:30:00';    // 30 minutes - normal
        if (zoomLevel >= 0.7) return '01:00:00';    // 1 hour - overview
        return '02:00:00';                          // 2 hours - high level
    }

    function handlePrecisionZoom(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY;
            const zoomFactor = delta > 0 ? 0.8 : 1.25;
            
            zoomLevel = Math.max(0.3, Math.min(5.0, zoomLevel * zoomFactor));
            
            // Smooth zoom update
            const newSlotDuration = getSlotDuration();
            calendar.setOption('slotDuration', newSlotDuration);
            calendar.setOption('slotLabelInterval', newSlotDuration);
            calendar.setOption('snapDuration', newSlotDuration);
            
            updateZoomIndicator();
            
            // Refresh events to update font sizes
            calendar.refetchEvents();
        }
    }

    function updateZoomIndicator() {
        const levels = {
            5: 'Ultra Detailed (5min slots)',
            3: 'Very Detailed (15min slots)', 
            2: 'Detailed (15min slots)',
            1.5: 'Normal (30min slots)',
            1: 'Normal (30min slots)',
            0.7: 'Overview (1hr slots)',
            0.3: 'High Level (2hr slots)'
        };
        
        let levelText = 'Custom';
        for (const [threshold, text] of Object.entries(levels)) {
            if (zoomLevel >= parseFloat(threshold)) {
                levelText = text;
                break;
            }
        }
        
        $('#zoom-level').text(levelText);
    }

    function enableHorizontalScrolling() {
        const calendarEl = calendarDiv[0];
        const scrollContainer = calendarEl.querySelector('.fc-scroller-harness');
        
        if (scrollContainer) {
            // Enable smooth horizontal scrolling
            scrollContainer.style.overflowX = 'auto';
            scrollContainer.style.scrollBehavior = 'smooth';
            
            // Add mouse wheel horizontal scroll
            scrollContainer.addEventListener('wheel', function(e) {
                if (!e.ctrlKey && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
                    e.preventDefault();
                    this.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }
    }

    function loadWorkOrderView() {
        frappe.call({
            method: 'kk_new_app.api.work_order_scheduler.get_scheduled_work_orders',
            callback: function (r) {
                if (calendar && r.message) {
                    calendar.removeAllEvents();
                    calendar.addEventSource(r.message);
                    updateWorkstationSummary([]);
                }
            }
        });
    }

    function loadOperationsView() {
        Promise.all([
            loadWorkstationData(),
            loadOperationData()
        ]).then(([workstations, operations]) => {
            workstationData = workstations;
            
            if (calendar && operations) {
                calendar.removeAllEvents();
                calendar.addEventSource(operations);
                updateWorkstationSummary(workstations);
                populateWorkstationSidebar(workstations);
            }
        });
    }

    function loadWorkstationData() {
        return new Promise(resolve => {
            frappe.call({
                method: 'kk_new_app.api.work_order_scheduler.get_workstations_resources',
                callback: function (r) {
                    resolve(r.message || []);
                }
            });
        });
    }

    function loadOperationData() {
        return new Promise(resolve => {
            frappe.call({
                method: 'kk_new_app.api.work_order_scheduler.get_job_cards_with_workstations',
                callback: function (r) {
                    resolve(r.message || []);
                }
            });
        });
    }

    function showWorkstationSidebar() {
        sidebarDiv.show();
        $('#workstation-summary').show();
    }

    function hideWorkstationSidebar() {
        sidebarDiv.hide();
        $('#workstation-summary').hide();
    }

    function populateWorkstationSidebar(workstations) {
        const listEl = $('#workstation-list');
        listEl.empty();
        
        workstations.forEach(wsType => {
            const typeEl = $(`
                <div class="workstation-type" style="margin-bottom: 15px;">
                    <div style="font-weight: bold; color: #42526e; margin-bottom: 5px; font-size: 12px;">
                        ${wsType.title} (${wsType.children.length})
                    </div>
                </div>
            `);
            
            wsType.children.forEach(ws => {
                const wsEl = $(`
                    <div class="workstation-item" data-workstation="${ws.id}" 
                         style="padding: 6px 10px; margin: 2px 0; background: #f4f5f7; border-radius: 3px; 
                                cursor: pointer; font-size: 11px; transition: background 0.2s;">
                        <div style="font-weight: 500;">${ws.title}</div>
                        <div style="color: #6b778c; font-size: 10px;">Click to highlight</div>
                    </div>
                `);
                
                wsEl.on('click', () => highlightWorkstation(ws.id));
                wsEl.on('mouseenter', () => wsEl.css('background', '#e4e6ea'));
                wsEl.on('mouseleave', () => wsEl.css('background', '#f4f5f7'));
                
                typeEl.append(wsEl);
            });
            
            listEl.append(typeEl);
        });
    }

    function highlightWorkstation(workstationId) {
        // Remove previous highlights
        $('.fc-event').removeClass('workstation-highlighted');
        
        // Highlight events for this workstation
        $(`.fc-event[data-workstation="${workstationId}"]`).addClass('workstation-highlighted');
        
        // Add CSS for highlighting if not exists
        if (!$('#workstation-highlight-css').length) {
            $('head').append(`
                <style id="workstation-highlight-css">
                    .workstation-highlighted {
                        box-shadow: 0 0 10px #ff9800 !important;
                        z-index: 999 !important;
                        transform: scale(1.02) !important;
                        transition: all 0.3s ease !important;
                    }
                </style>
            `);
        }
        
        // Scroll to first event of this workstation
        const firstEvent = $(`.fc-event[data-workstation="${workstationId}"]`).first();
        if (firstEvent.length) {
            firstEvent[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function updateWorkstationSummary(workstations) {
        const summaryEl = $('#workstation-summary');
        if (workstations.length === 0) {
            summaryEl.hide();
            return;
        }
        
        const totalWorkstations = workstations.reduce((sum, type) => sum + type.children.length, 0);
        const typeCount = workstations.length;
        
        summaryEl.html(`
            📊 <strong>${totalWorkstations}</strong> workstations across <strong>${typeCount}</strong> types
            | Use sidebar to highlight specific workstations
        `).show();
    }

    function setupEnhancedTooltip(info) {
        const isOperation = info.event.extendedProps.type === 'operation';
        
        info.el.addEventListener("mouseenter", (e) => {
            let content = '';
            
            if (isOperation) {
                const props = info.event.extendedProps;
                const progress = props.for_quantity > 0 ? 
                    Math.round((props.completed_qty / props.for_quantity) * 100) : 0;
                
                content = `
                    <div style="border-left: 4px solid ${info.event.borderColor}; padding-left: 8px;">
                        <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px;">
                            🔧 ${props.job_card_name || info.event.id}: ${props.operation}
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Work Order:</strong> <span style="color: #3498db;">${props.work_order}</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Workstation:</strong> ${props.workstation}
                            <span style="color: #7f8c8d;">(${props.workstation_type})</span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Status:</strong> 
                            <span style="color: ${getStatusColor(props.status)}; font-weight: bold;">
                                ${props.status}
                            </span>
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Progress:</strong> ${props.completed_qty}/${props.for_quantity} (${progress}%)
                        </div>
                        <div style="color: #7f8c8d; font-size: 11px; margin-top: 6px;">
                            Production: ${props.production_item} (${props.work_order_qty} total)
                        </div>
                    </div>
                `;
            } else {
                const props = info.event.extendedProps;
                content = `
                    <div style="border-left: 4px solid #3498db; padding-left: 8px;">
                        <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px;">
                            📋 Work Order: ${info.event.title}
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Quantity:</strong> ${props.qty}
                        </div>
                        <div style="margin-bottom: 4px;">
                            <strong>Delivery:</strong> ${frappe.datetime.str_to_user(props.delivery)}
                        </div>
                    </div>
                `;
            }
            
            tooltipEl.innerHTML = content;
            positionTooltip(e);
            tooltipEl.style.display = "block";
        });

        info.el.addEventListener("mousemove", positionTooltip);
        info.el.addEventListener("mouseleave", () => {
            tooltipEl.style.display = "none";
        });
    }

    function positionTooltip(e) {
        const margin = 15;
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = e.pageX + margin;
        let top = e.pageY + margin;
        
        // Adjust if tooltip would go off screen
        if (left + tooltipRect.width > viewportWidth) {
            left = e.pageX - tooltipRect.width - margin;
        }
        if (top + tooltipRect.height > viewportHeight) {
            top = e.pageY - tooltipRect.height - margin;
        }
        
        tooltipEl.style.left = left + "px";
        tooltipEl.style.top = top + "px";
    }

    function getStatusColor(status) {
        const colors = {
            'Open': '#3498db',
            'Work In Progress': '#f39c12', 
            'Completed': '#27ae60',
            'Material Transferred': '#9b59b6',
            'On Hold': '#e74c3c',
            'Cancelled': '#95a5a6'
        };
        return colors[status] || '#34495e';
    }

    function handleEventDrop(info) {
        const isOperation = info.event.extendedProps.type === 'operation';
        
        console.log('Drag attempted:', {
            isOperation: isOperation,
            eventId: info.event.id,
            status: info.event.extendedProps.status,
            title: info.event.title
        });
        
        const method = isOperation ? 
            'kk_new_app.api.work_order_scheduler.update_job_card_schedule' :
            'kk_new_app.api.work_order_scheduler.update_work_order_schedule';
        
        frappe.call({
            method: method,
            args: {
                name: info.event.id,
                new_start: info.event.startStr,
                new_end: info.event.endStr
            },
            callback: () => {
                frappe.show_alert({
                    message: `${isOperation ? 'Operation' : 'Work Order'} rescheduled successfully`,
                    indicator: 'green'
                });
            },
            error: (error) => {
                console.error('Drag and drop error:', error);
                frappe.msgprint("Rescheduling failed: " + (error.message || 'Unknown error'));
                info.revert();
            }
        });
    }

    function handleEventResize(info) {
        const isOperation = info.event.extendedProps.type === 'operation';
        const method = isOperation ? 
            'kk_new_app.api.work_order_scheduler.update_job_card_schedule' :
            'kk_new_app.api.work_order_scheduler.update_work_order_schedule';

        frappe.call({
            method: method,
            args: {
                name: info.event.id,
                new_start: info.event.startStr,
                new_end: info.event.endStr
            },
            callback: () => {
                frappe.show_alert({
                    message: `${isOperation ? 'Operation' : 'Work Order'} duration updated`,
                    indicator: 'green'
                });
            },
            error: (error) => {
                frappe.msgprint("Duration update failed: " + error.message);
                info.revert();
            }
        });
    }

    // Event handlers
    $('#work-order-view').on('click', function() {
        currentView = 'work_orders';
        $(this).removeClass('btn-secondary').addClass('btn-primary');
        $('#operations-view, #utilization-view').removeClass('btn-primary').addClass('btn-secondary');
        initializeCalendar('work_orders');
    });

    $('#operations-view').on('click', function() {
        currentView = 'operations';
        $(this).removeClass('btn-secondary').addClass('btn-primary');
        $('#work-order-view, #utilization-view').removeClass('btn-primary').addClass('btn-secondary');
        initializeCalendar('operations');
    });

    $('#utilization-view').on('click', function() {
        showUtilizationDialog();
    });

    $('#zoom-in').on('click', () => {
        zoomLevel = Math.min(5.0, zoomLevel * 1.4);
        applyZoom();
    });

    $('#zoom-out').on('click', () => {
        zoomLevel = Math.max(0.3, zoomLevel / 1.4);
        applyZoom();
    });

    $('#refresh-btn').on('click', () => {
        if (currentView === 'work_orders') {
            loadWorkOrderView();
        } else {
            loadOperationsView();
        }
        frappe.show_alert('Calendar refreshed');
    });

    $('#jump-to-date').on('change', function() {
        if (calendar && this.value) {
            calendar.gotoDate(this.value);
        }
    });

    function applyZoom() {
        const newSlotDuration = getSlotDuration();
        calendar.setOption('slotDuration', newSlotDuration);
        calendar.setOption('slotLabelInterval', newSlotDuration);
        calendar.setOption('snapDuration', newSlotDuration);
        updateZoomIndicator();
        calendar.refetchEvents();
    }

    function showUtilizationDialog() {
        const start = calendar.view.activeStart;
        const end = calendar.view.activeEnd;
        
        frappe.call({
            method: 'kk_new_app.api.work_order_scheduler.get_workstation_utilization',
            args: {
                start_date: start.toISOString().split('T')[0],
                end_date: end.toISOString().split('T')[0]
            },
            callback: function (r) {
                const dialog = new frappe.ui.Dialog({
                    title: 'Workstation Utilization Analysis',
                    size: 'large',
                    fields: [{
                        fieldtype: 'HTML',
                        fieldname: 'utilization_data'
                    }]
                });

                let html = `
                    <div style="margin-bottom: 15px;">
                        <h6>Period: ${frappe.datetime.str_to_user(start.toISOString().split('T')[0])} to ${frappe.datetime.str_to_user(end.toISOString().split('T')[0])}</h6>
                    </div>
                    <table class="table table-striped">
                        <thead style="background: #f8f9fa;">
                            <tr>
                                <th>Workstation</th>
                                <th>Type</th>
                                <th>Total Jobs</th>
                                <th>Completed</th>
                                <th>Total Hours</th>
                                <th>Avg Duration</th>
                                <th>Utilization</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                r.message.forEach(row => {
                    const totalHours = (row.total_minutes / 60).toFixed(1);
                    const avgDuration = (row.avg_duration || 0).toFixed(0);
                    const completionRate = ((row.completed_jobs / row.total_jobs) * 100).toFixed(1);
                    const utilization = Math.min(100, (row.total_minutes / (8 * 60)) * 100).toFixed(1); // Assuming 8hr workday
                    
                    html += `
                        <tr>
                            <td><strong>${row.workstation_name}</strong></td>
                            <td><span class="badge badge-light">${row.workstation_type || 'N/A'}</span></td>
                            <td>${row.total_jobs}</td>
                            <td>${row.completed_jobs} (${completionRate}%)</td>
                            <td>${totalHours}h</td>
                            <td>${avgDuration}min</td>
                            <td>
                                <div class="progress" style="height: 20px;">
                                    <div class="progress-bar ${utilization > 80 ? 'bg-danger' : utilization > 60 ? 'bg-warning' : 'bg-success'}" 
                                         style="width: ${utilization}%">${utilization}%</div>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                
                dialog.fields_dict.utilization_data.$wrapper.html(html);
                dialog.show();
            }
        });
    }

    // Auto-refresh
    function startAutoRefresh() {
        refreshInterval = setInterval(() => {
            if (currentView === 'work_orders') {
                loadWorkOrderView();
            } else if (currentView === 'operations') {
                loadOperationsView();
            }
        }, 2000);
    }

    // Keyboard shortcuts
    $(document).on('keydown', function(e) {
        if (e.ctrlKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    $('#work-order-view').click();
                    break;
                case '2':
                    e.preventDefault();
                    $('#operations-view').click();
                    break;
                case 'r':
                    e.preventDefault();
                    $('#refresh-btn').click();
                    break;
            }
        }
    });

    // Initialize
    initializeCalendar('work_orders');
    startAutoRefresh();
    
    // Set today's date in jump-to-date
    $('#jump-to-date').val(new Date().toISOString().split('T')[0]);

    // Cleanup
    $(window).on('beforeunload', () => {
        if (refreshInterval) clearInterval(refreshInterval);
    });
};

async function load_fullcalendar_assets() {
    // Load CSS with fallback
    if (!document.querySelector('link[href*="fullcalendar"]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css";
        document.head.appendChild(css);
    }

    // Load main FullCalendar JS
    if (!window.FullCalendar) {
        const js = document.createElement("script");
        js.src = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js";
        document.head.appendChild(js);
        await new Promise((resolve, reject) => {
            js.onload = resolve;
            js.onerror = reject;
        });
    }
}