import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { destroySession, getSession } from "../lib/session.server";

async function clearAndRedirect(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  return clearAndRedirect(request);
}
// Por si alguien navega directo a /logout (GET)
export async function loader({ request }: LoaderFunctionArgs) {
  return clearAndRedirect(request);
}
