frappe.pages['work_order_calendar'].on_page_load = async function (wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Work Order Calendar',
        single_column: true
    });

    await load_fullcalendar_assets();

    const calendarDiv = $(`<div id="calendar"></div>`).appendTo(page.body);

    // Create a custom tooltip element
    const tooltipEl = document.createElement("div");
    tooltipEl.style.position = "absolute";
    tooltipEl.style.padding = "8px";
    tooltipEl.style.background = "#f9f9f9";
    tooltipEl.style.border = "1px solid #ccc";
    tooltipEl.style.borderRadius = "6px";
    tooltipEl.style.boxShadow = "0 2px 10px rgba(0,0,0,0.1)";
    tooltipEl.style.zIndex = "1000";
    tooltipEl.style.display = "none";
    document.body.appendChild(tooltipEl);

    frappe.call({
        method: 'kk_new_app.api.work_order_scheduler.get_scheduled_work_orders',
        callback: function (r) {
            const calendar = new FullCalendar.Calendar(calendarDiv[0], {
                initialView: 'timeGridWeek',
                editable: true,
                nowIndicator: true,
                eventResizableFromStart: true,

                eventContent: function (arg) {
                    return { html: `<div style="padding:2px">${arg.event.title}</div>` };
                },

                eventDidMount: function (info) {
                    // Show popup on hover
                    info.el.addEventListener("mouseenter", (e) => {
                        const props = info.event.extendedProps;
                        tooltipEl.innerHTML = `
                            <b>${info.event.title}</b><br>
                            Qty: ${props.qty}<br>
                            Delivery: ${frappe.datetime.str_to_user(props.delivery)}
                        `;
                        tooltipEl.style.left = e.pageX + 10 + "px";
                        tooltipEl.style.top = e.pageY + 10 + "px";
                        tooltipEl.style.display = "block";
                    });

                    info.el.addEventListener("mousemove", (e) => {
                        tooltipEl.style.left = e.pageX + 10 + "px";
                        tooltipEl.style.top = e.pageY + 10 + "px";
                    });

                    info.el.addEventListener("mouseleave", () => {
                        tooltipEl.style.display = "none";
                    });
                },

                eventClick: function (info) {
                    frappe.set_route("Form", "Work Order", info.event.id);
                },

                events: r.message,

                eventDrop: function (info) {
                    frappe.call({
                        method: 'kk_new_app.api.work_order_scheduler.update_work_order_schedule',
                        args: {
                            name: info.event.id,
                            new_start: info.event.startStr,
                            new_end: info.event.endStr
                        },
                        callback: () => frappe.show_alert("Work Order updated."),
                        error: () => {
                            frappe.msgprint("Failed to update Work Order.");
                            info.revert();
                        }
                    });
                },

                eventResize: function (info) {
                    frappe.call({
                        method: 'kk_new_app.api.work_order_scheduler.update_work_order_schedule',
                        args: {
                            name: info.event.id,
                            new_start: info.event.startStr,
                            new_end: info.event.endStr
                        },
                        callback: () => frappe.show_alert("Work Order resized."),
                        error: () => {
                            frappe.msgprint("Resize failed.");
                            info.revert();
                        }
                    });
                }
            });

            calendar.render();
        }
    });
};

async function load_fullcalendar_assets() {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.css";
    document.head.appendChild(css);

    if (!window.FullCalendar) {
        const js = document.createElement("script");
        js.src = "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js";
        document.head.appendChild(js);
        await new Promise(resolve => js.onload = resolve);
    }
}
