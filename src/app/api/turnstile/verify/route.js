export async function POST(request) {
  try {
    const { token, remoteip } = await request.json();
    if (!token) {
      return Response.json({ success: false, error: "Missing token" }, { status: 400 });
    }

    const secret = process.env.TURNSTILE_SECRET;
    if (!secret) {
      return Response.json({ success: false, error: "Server misconfigured" }, { status: 500 });
    }

    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (remoteip) formData.append("remoteip", remoteip);

    const result = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      }
    ).then((r) => r.json());

    return Response.json({ success: !!result.success, result });
  } catch (e) {
    return Response.json({ success: false, error: "Verification failed" }, { status: 500 });
  }
}

