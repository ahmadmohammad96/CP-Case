frappe.ui.form.on('Work Order', {
    refresh(frm) {
        frm.add_custom_button("Auto Schedule", () => {
            frappe.call({
                method: "kk_new_app.api.work_order_scheduler.auto_schedule_new_work_order",
                args: { work_order_name: frm.doc.name },
                callback: () => {
                    frappe.show_alert("Auto scheduled! Refresh calendar.");
                    frm.reload_doc();
                }
            });
        });
    }
});
