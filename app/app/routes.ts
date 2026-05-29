import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("api/ai", "routes/api.ai.tsx"),
  route("api/deal-update", "routes/api.deal-update.tsx"),
  route("api/lead-create", "routes/api.lead-create.tsx"),
  route("api/deal-delete", "routes/api.deal-delete.tsx"),
  route("api/stages", "routes/api.stages.tsx"),
  layout("routes/_app.tsx", [
    index("routes/dashboard.tsx"),
    route("inbox", "routes/inbox.tsx"),
    route("pipeline", "routes/pipeline.tsx"),
    route("forecast", "routes/forecast.tsx"),
    route("customers", "routes/customers.tsx"),
    route("chat", "routes/chat.tsx"),
    route("templates", "routes/templates.tsx"),
    route("sequences", "routes/sequences.tsx"),
    route("objects", "routes/objects.tsx"),
    route("schema", "routes/schema.tsx"),
    route("settings", "routes/settings.tsx"),
    route("empresas", "routes/empresas.tsx"),
    route("users", "routes/users.tsx"),
    route("atoms", "routes/atoms.tsx"),
  ]),
] satisfies RouteConfig;
