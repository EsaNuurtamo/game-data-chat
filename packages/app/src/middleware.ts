import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/public(.*)",
]);

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublic(req)) await auth.protect(); // redirect unauthenticated users
  },
  {
    //contentSecurityPolicy: { strict: true }
  }
);

export const config = {
  matcher: [
    // Skip Next internals/static, but always run for API
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
