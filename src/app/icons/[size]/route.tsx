import { ImageResponse } from "next/og";

export const runtime = "edge";

const sizes = new Set(["192", "512"]);

export async function GET(
  _request: Request,
  { params }: { params: { size: string } },
) {
  const raw = params.size;
  if (!sizes.has(raw)) {
    return new Response("Not found", { status: 404 });
  }

  const px = raw === "512" ? 512 : 192;
  const fontSize = Math.round(px * 0.28);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #1c1917 0%, #292524 100%)",
          color: "#fafaf9",
          fontSize,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        SL
      </div>
    ),
    { width: px, height: px },
  );
}
