app_name = "kk_new_app"
app_title = "Kk New App"
app_publisher = "ahmad mohammad"
app_description = "init"
app_email = "ahmad900mohammad@gmail.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "kk_new_app",
# 		"logo": "/assets/kk_new_app/logo.png",
# 		"title": "Kk New App",
# 		"route": "/kk_new_app",
# 		"has_permission": "kk_new_app.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------


# Add these lines to your existing hooks.py file
# Page configurations
# App include JS and CSS
# app_include_js = [
#     "/assets/kk_new_app/js/capacity_planning.js"
# ]

# app_include_css = [
#     "/assets/kk_new_app/css/capacity_planning.css"
# ]

# # List of pages
# page_js = {
#     "capacity-planning": "public/js/capacity_planning.js"
# }

# This will allow the FullCalendar library to be loaded via CDN in our JS file
# include js, css files in header of desk.html
# app_include_css = "/assets/kk_new_app/css/kk_new_app.css"
# app_include_js = "/assets/kk_new_app/js/kk_new_app.js"

# include js, css files in header of web template
# web_include_css = "/assets/kk_new_app/css/kk_new_app.css"
# web_include_js = "/assets/kk_new_app/js/kk_new_app.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "kk_new_app/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# Register the page
# page_js = {
#     "work_order_calendar": "/assets/kk_new_app/js/work_order_calendar.js"
# }

doctype_js = {
    "Work Order": "kk_new_app/page/work_order_calendar/work_order_custom.js"
}
# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "kk_new_app/public/icons.svg"

# Home Pages
# ----------
# Add this to register the desk page
# desk_pages = {
#     "work_order_calendar": {
#         "title": "Work Order Calendar",
#         "route": "work_order_calendar",
#         "icon": "calendar"
#     }
# }
# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "kk_new_app.utils.jinja_methods",
# 	"filters": "kk_new_app.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "kk_new_app.install.before_install"
# after_install = "kk_new_app.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "kk_new_app.uninstall.before_uninstall"
# after_uninstall = "kk_new_app.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "kk_new_app.utils.before_app_install"
# after_app_install = "kk_new_app.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "kk_new_app.utils.before_app_uninstall"
# after_app_uninstall = "kk_new_app.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "kk_new_app.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }
# doc_events = {
#     "Work Order": {
#         "after_insert": "kk_new_app.api.work_order_scheduler.auto_schedule_work_order",
#     }
# }
# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"kk_new_app.tasks.all"
# 	],
# 	"daily": [
# 		"kk_new_app.tasks.daily"
# 	],
# 	"hourly": [
# 		"kk_new_app.tasks.hourly"
# 	],
# 	"weekly": [
# 		"kk_new_app.tasks.weekly"
# 	],
# 	"monthly": [
# 		"kk_new_app.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "kk_new_app.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "kk_new_app.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "kk_new_app.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["kk_new_app.utils.before_request"]
# after_request = ["kk_new_app.utils.after_request"]

# Job Events
# ----------
# before_job = ["kk_new_app.utils.before_job"]
# after_job = ["kk_new_app.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"kk_new_app.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# website_route_rules = [
#     {"from_route": "/work-order-calendar", "to_route": "kk_new_app.www.work_order_calendar"},
# ]

# # Create a page for the work order calendar
# website_pages = [
#     {
#         "page_name": "work_order_calendar",
#         "title": "Work Order Calendar",
#         "route": "work_order_calendar",
#     }
# ]