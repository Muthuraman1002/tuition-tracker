// Class reminders are local notifications, which don't need the Push Notifications capability.
// expo-notifications adds it anyway, and free (personal) Apple developer teams can't sign apps with it, so remove it.
const { withEntitlementsPlist } = require("expo/config-plugins");
module.exports = (config) => withEntitlementsPlist(config, (c) => { delete c.modResults["aps-environment"]; return c; });
