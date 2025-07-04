frappe.ui.form.on('Work Order', {
    refresh(frm) {
        // Auto Schedule Work Order button
        frm.add_custom_button("Auto Schedule Work Order", () => {
            frappe.call({
                method: "kk_new_app.api.work_order_scheduler.auto_schedule_new_work_order",
                args: { work_order_name: frm.doc.name },
                callback: (r) => {
                    frappe.show_alert("Work Order auto scheduled! Check the calendar.");
                    frm.reload_doc();
                }
            });
        }, "Scheduling");

        // Auto Schedule Job Cards button
        if (frm.doc.planned_start_date && frm.doc.planned_end_date) {
            frm.add_custom_button("Auto Schedule Job Cards", () => {
                frappe.call({
                    method: "kk_new_app.api.work_order_scheduler.auto_schedule_job_cards_for_work_order",
                    args: { work_order_name: frm.doc.name },
                    callback: (r) => {
                        frappe.show_alert(r.message);
                        refresh_job_cards_view(frm);
                    },
                    error: (error) => {
                        frappe.msgprint("Error scheduling Job Cards: " + error.message);
                    }
                });
            }, "Scheduling");
        }

        // Open Calendar button
        frm.add_custom_button("Open Calendar", () => {
            frappe.set_route("work_order_calendar");
        }, "View");

        // Bulk Create Test Work Orders button (for demo/testing)
        if (frappe.user.has_role("System Manager")) {
            frm.add_custom_button("Create Test Work Orders (50)", () => {
                frappe.confirm(
                    'This will create 50 test work orders for demonstration. Continue?',
                    () => {
                        frappe.call({
                            method: "kk_new_app.api.work_order_scheduler.create_bulk_test_work_orders",
                            args: { count: 50 },
                            callback: (r) => {
                                frappe.show_alert(r.message);
                                frappe.msgprint("Test work orders created. You can now use Auto Schedule to schedule them.");
                            }
                        });
                    }
                );
            }, "Testing");

            // Create Test Job Cards button
            frm.add_custom_button("Create Test Job Cards", () => {
                frappe.call({
                    method: "kk_new_app.api.work_order_scheduler.create_test_job_cards",
                    callback: (r) => {
                        frappe.show_alert(r.message);
                        refresh_job_cards_view(frm);
                    }
                });
            }, "Testing");
        }

        // Show Job Cards section if they exist
        if (frm.doc.name) {
            refresh_job_cards_view(frm);
        }

        // Add custom indicator for scheduling status
        update_scheduling_indicator(frm);
    },

    planned_start_date(frm) {
        update_scheduling_indicator(frm);
    },

    planned_end_date(frm) {
        update_scheduling_indicator(frm);
    },

    onload(frm) {
        // Set up any initial configurations
        if (frm.doc.__islocal) {
            // For new work orders, suggest using auto-scheduling
            setTimeout(() => {
                if (!frm.doc.planned_start_date) {
                    frappe.show_alert({
                        message: "💡 Tip: Use 'Auto Schedule Work Order' for optimal scheduling",
                        indicator: 'blue'
                    });
                }
            }, 2000);
        }
    }
});

function update_scheduling_indicator(frm) {
    // Clear existing indicators
    frm.dashboard.clear_headline();
    
    if (frm.doc.planned_start_date && frm.doc.planned_end_date) {
        frm.dashboard.add_indicator(__('✅ Scheduled'), 'green');
        
        // Check if delivery date is at risk
        if (frm.doc.expected_delivery_date && frm.doc.planned_end_date) {
            const delivery_date = new Date(frm.doc.expected_delivery_date);
            const planned_end = new Date(frm.doc.planned_end_date);
            
            if (planned_end > delivery_date) {
                frm.dashboard.add_indicator(__('⚠️ Delivery Risk'), 'red');
            }
        }
    } else {
        frm.dashboard.add_indicator(__('⏱️ Not Scheduled'), 'orange');
    }
    
    // Show job cards count if any exist
    if (frm.doc.name) {
        frappe.call({
            method: 'frappe.client.get_count',
            args: {
                doctype: 'Job Card',
                filters: { work_order: frm.doc.name }
            },
            callback: function(r) {
                if (r.message > 0) {
                    frm.dashboard.add_indicator(__(`🔧 ${r.message} Job Cards`), 'blue');
                }
            }
        });
    }
}

function refresh_job_cards_view(frm) {
    // Get job cards for this work order
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Job Card',
            filters: {
                work_order: frm.doc.name
            },
            fields: [
                'name', 'operation', 'workstation', 'status', 
                'expected_start_date', 'expected_end_date',
                'actual_start_date', 'actual_end_date',
                'total_completed_qty', 'for_quantity', 'sequence_id'
            ],
            order_by: 'sequence_id asc, operation_id asc'
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                render_job_cards_section(frm, r.message);
            } else if (frm.job_cards_wrapper) {
                frm.job_cards_wrapper.remove();
            }
        }
    });
}

function render_job_cards_section(frm, job_cards) {
    // Remove existing section if any
    if (frm.job_cards_wrapper) {
        frm.job_cards_wrapper.remove();
    }

    // Create new section
    frm.job_cards_wrapper = $(`
        <div class="job-cards-section" style="margin-top: 20px; border: 1px solid #d1d8dd; border-radius: 6px; overflow: hidden;">
            <div class="section-head" style="background: #f8f9fa; padding: 12px 15px; border-bottom: 1px solid #d1d8dd; display: flex; justify-content: space-between; align-items: center;">
                <h5 style="margin: 0; color: #36414c;">🔧 Operations Schedule (${job_cards.length} operations)</h5>
                <div>
                    <button class="btn btn-xs btn-default refresh-job-cards" style="margin-right: 8px;">🔄 Refresh</button>
                    <button class="btn btn-xs btn-primary open-calendar">📅 Open Calendar</button>
                </div>
            </div>
            <div class="job-cards-timeline" style="padding: 15px;"></div>
        </div>
    `).appendTo(frm.body);

    // Add functionality
    frm.job_cards_wrapper.find('.refresh-job-cards').on('click', () => {
        refresh_job_cards_view(frm);
    });

    frm.job_cards_wrapper.find('.open-calendar').on('click', () => {
        frappe.set_route("work_order_calendar");
    });

    // Render timeline
    render_job_cards_timeline(frm.job_cards_wrapper.find('.job-cards-timeline'), job_cards);
}

function render_job_cards_timeline(container, job_cards) {
    let html = '<div class="job-cards-timeline-container">';
    
    // Timeline header
    html += `
        <div class="timeline-header" style="display: grid; grid-template-columns: 50px 200px 150px 120px 140px 140px 100px 1fr; gap: 10px; background: #f8f9fa; padding: 10px; border: 1px solid #ddd; font-weight: bold; font-size: 12px;">
            <div>Seq</div>
            <div>Operation</div>
            <div>Workstation</div>
            <div>Status</div>
            <div>Scheduled Start</div>
            <div>Scheduled End</div>
            <div>Progress</div>
            <div>Actions</div>
        </div>
    `;

    // Timeline rows
    job_cards.forEach((jc, index) => {
        const status_color = get_status_color(jc.status);
        const progress = jc.for_quantity > 0 ? ((jc.total_completed_qty || 0) / jc.for_quantity * 100).toFixed(1) : 0;
        const scheduled_start = jc.expected_start_date ? frappe.datetime.str_to_user(jc.expected_start_date) : 'Not Scheduled';
        const scheduled_end = jc.expected_end_date ? frappe.datetime.str_to_user(jc.expected_end_date) : 'Not Scheduled';
        const sequence = jc.sequence_id || (index + 1);

        // Determine row background color based on status
        let rowBg = '#fff';
        if (jc.status === 'Completed') rowBg = '#f0f9f0';
        else if (jc.status === 'Work In Progress') rowBg = '#fff8e1';
        else if (jc.status === 'On Hold') rowBg = '#ffebee';

        html += `
            <div class="timeline-row" style="display: grid; grid-template-columns: 50px 200px 150px 120px 140px 140px 100px 1fr; gap: 10px; padding: 10px; border-left: 1px solid #ddd; border-right: 1px solid #ddd; border-bottom: 1px solid #ddd; align-items: center; background: ${rowBg}; font-size: 12px;">
                <div style="font-weight: bold; color: #666;">Op${sequence}</div>
                <div style="font-weight: 500;">${jc.operation}</div>
                <div style="color: #666;">${jc.workstation || 'Not Assigned'}</div>
                <div>
                    <span class="indicator-pill ${status_color}" style="padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 500;">${jc.status}</span>
                </div>
                <div style="font-size: 11px; color: #666;">${scheduled_start}</div>
                <div style="font-size: 11px; color: #666;">${scheduled_end}</div>
                <div>
                    <div class="progress" style="height: 16px; background: #e9ecef; border-radius: 8px; overflow: hidden;">
                        <div class="progress-bar" style="width: ${progress}%; background: ${getProgressColor(progress)}; height: 100%; line-height: 16px; text-align: center; font-size: 10px; font-weight: bold; color: white;">
                            ${progress > 20 ? progress + '%' : ''}
                        </div>
                    </div>
                    ${progress <= 20 ? `<div style="font-size: 10px; text-align: center; margin-top: 2px;">${progress}%</div>` : ''}
                </div>
                <div>
                    <button class="btn btn-xs btn-default open-job-card" data-name="${jc.name}" style="margin-right: 4px;">Open</button>
                    <button class="btn btn-xs btn-light copy-name" data-name="${jc.name}" title="Copy Job Card Name">📋</button>
                </div>
            </div>
        `;
    });

    html += '</div>';
    
    // Add summary section
    const totalProgress = job_cards.length > 0 ? 
        (job_cards.reduce((sum, jc) => sum + (jc.for_quantity > 0 ? (jc.total_completed_qty || 0) / jc.for_quantity * 100 : 0), 0) / job_cards.length).toFixed(1) : 0;
    
    html += `
        <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; font-size: 12px;">
            <strong>Summary:</strong> ${job_cards.length} operations | 
            Average Progress: ${totalProgress}% | 
            Completed: ${job_cards.filter(jc => jc.status === 'Completed').length} | 
            In Progress: ${job_cards.filter(jc => jc.status === 'Work In Progress').length}
        </div>
    `;

    container.html(html);

    // Add click handlers
    container.find('.open-job-card').on('click', function() {
        const job_card_name = $(this).data('name');
        frappe.set_route('Form', 'Job Card', job_card_name);
    });

    container.find('.copy-name').on('click', function() {
        const job_card_name = $(this).data('name');
        navigator.clipboard.writeText(job_card_name).then(() => {
            frappe.show_alert({
                message: `Job Card name "${job_card_name}" copied to clipboard`,
                indicator: 'green'
            });
        });
    });
}

function get_status_color(status) {
    const status_colors = {
        'Open': 'blue',
        'Work In Progress': 'orange',
        'Completed': 'green',
        'Material Transferred': 'purple',
        'On Hold': 'red',
        'Cancelled': 'gray'
    };
    return status_colors[status] || 'gray';
}

function getProgressColor(progress) {
    if (progress >= 100) return '#28a745';
    if (progress >= 75) return '#20c997';
    if (progress >= 50) return '#ffc107';
    if (progress >= 25) return '#fd7e14';
    return '#dc3545';
}

// Enhanced functionality for Job Card form
frappe.ui.form.on('Job Card', {
    refresh(frm) {
        // Add workstation availability check
        if (frm.doc.workstation && frm.doc.expected_start_date && frm.doc.expected_end_date) {
            frm.add_custom_button("Check Workstation Availability", () => {
                check_workstation_availability(frm);
            }, "Scheduling");
        }

        // Open calendar for this job card
        frm.add_custom_button("Open Calendar", () => {
            frappe.set_route("work_order_calendar");
        }, "View");

        // Quick reschedule button
        if (frm.doc.workstation) {
            frm.add_custom_button("Quick Reschedule", () => {
                quick_reschedule_dialog(frm);
            }, "Scheduling");
        }

        // Add scheduling indicator
        if (frm.doc.expected_start_date && frm.doc.expected_end_date) {
            frm.dashboard.add_indicator(__('✅ Scheduled'), 'green');
        } else {
            frm.dashboard.add_indicator(__('⏱️ Not Scheduled'), 'orange');
        }

        // Show work order link prominently
        if (frm.doc.work_order) {
            frm.dashboard.add_indicator(__(`📋 WO: ${frm.doc.work_order}`), 'blue');
        }
    },

    workstation(frm) {
        if (frm.doc.workstation && frm.doc.expected_start_date && frm.doc.expected_end_date) {
            check_workstation_availability(frm);
        }
    },

    expected_start_date(frm) {
        if (frm.doc.workstation && frm.doc.expected_start_date && frm.doc.expected_end_date) {
            check_workstation_availability(frm);
        }
    },

    expected_end_date(frm) {
        if (frm.doc.workstation && frm.doc.expected_start_date && frm.doc.expected_end_date) {
            check_workstation_availability(frm);
        }
    }
});

function check_workstation_availability(frm) {
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Job Card',
            filters: {
                workstation: frm.doc.workstation,
                name: ['!=', frm.doc.name],
                docstatus: ['<', 2]
            },
            fields: ['name', 'operation', 'expected_start_date', 'expected_end_date', 'work_order'],
            order_by: 'expected_start_date asc'
        },
        callback: function(r) {
            const overlapping = [];
            const my_start = new Date(frm.doc.expected_start_date);
            const my_end = new Date(frm.doc.expected_end_date);

            r.message.forEach(jc => {
                if (jc.expected_start_date && jc.expected_end_date) {
                    const other_start = new Date(jc.expected_start_date);
                    const other_end = new Date(jc.expected_end_date);

                    // Check for overlap
                    if ((my_start < other_end && my_end > other_start)) {
                        overlapping.push(jc);
                    }
                }
            });

            if (overlapping.length > 0) {
                let message = `<div style="color: #e74c3c;"><b>⚠️ Workstation Conflict Detected!</b></div><br>`;
                message += `This job card overlaps with <b>${overlapping.length}</b> other job card(s) on workstation <b>${frm.doc.workstation}</b>:<br><br>`;
                overlapping.forEach(jc => {
                    message += `• <b>${jc.operation}</b> (${jc.name})<br>`;
                    message += `&nbsp;&nbsp;${frappe.datetime.str_to_user(jc.expected_start_date)} - ${frappe.datetime.str_to_user(jc.expected_end_date)}<br>`;
                    message += `&nbsp;&nbsp;Work Order: ${jc.work_order}<br><br>`;
                });
                
                frappe.msgprint({
                    title: 'Scheduling Conflict',
                    message: message,
                    indicator: 'red'
                });
            } else {
                frappe.show_alert({
                    message: `✅ Workstation ${frm.doc.workstation} is available for the scheduled time.`,
                    indicator: 'green'
                });
            }
        }
    });
}

function quick_reschedule_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: 'Quick Reschedule Job Card',
        fields: [
            {
                fieldtype: 'Datetime',
                fieldname: 'new_start',
                label: 'New Start Date/Time',
                default: frm.doc.expected_start_date,
                reqd: 1
            },
            {
                fieldtype: 'Datetime', 
                fieldname: 'new_end',
                label: 'New End Date/Time',
                default: frm.doc.expected_end_date,
                reqd: 1
            },
            {
                fieldtype: 'Link',
                fieldname: 'new_workstation',
                label: 'Workstation (optional)',
                options: 'Workstation',
                default: frm.doc.workstation
            }
        ],
        primary_action_label: 'Reschedule',
        primary_action: function(values) {
            frappe.call({
                method: 'kk_new_app.api.work_order_scheduler.update_job_card_schedule',
                args: {
                    name: frm.doc.name,
                    new_start: values.new_start,
                    new_end: values.new_end,
                    new_workstation: values.new_workstation
                },
                callback: function(r) {
                    frappe.show_alert('Job Card rescheduled successfully!');
                    frm.reload_doc();
                    dialog.hide();
                },
                error: function(error) {
                    frappe.msgprint('Rescheduling failed: ' + error.message);
                }
            });
        }
    });
    
    dialog.show();
}