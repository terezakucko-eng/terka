import { describe, expect, it } from "vitest";
import { videoEmbedUrl } from "@/lib/video";

describe("videoEmbedUrl", () => {
  it("understands YouTube and Vimeo links", () => {
    const yt = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0";
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe(yt);
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(yt);
    expect(videoEmbedUrl("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(yt);
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789?dnt=1");
  });
  it("rejects anything else", () => {
    expect(videoEmbedUrl("https://example.com/video.mp4")).toBeNull();
    expect(videoEmbedUrl("nesmysl")).toBeNull();
    expect(videoEmbedUrl("")).toBeNull();
  });
});
