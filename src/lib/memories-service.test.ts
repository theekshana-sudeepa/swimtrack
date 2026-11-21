import { describe, it, expect, beforeEach } from "vitest";
import { DataStore } from "./data-store";
import {
  isValidMemoryDate,
  detectImageMimeFromBytes,
  addPhotosToMemoryDate,
  deleteMemoryOrPhoto,
  updateMemoryDetails,
  type MemoryActor,
} from "./memories-service";

// Minimal valid magic-byte buffers for JPEG, PNG, and WebP
const FAKE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
]);
const FAKE_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const FAKE_WEBP = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const adminActor: MemoryActor = {
  role: "admin",
  name: "Squad Coach",
  swimmerId: null,
  swimmerToken: null,
};

const swimmerA: MemoryActor = {
  role: "swimmer",
  name: "Liam",
  swimmerId: "11111111-1111-1111-1111-111111111101",
  swimmerToken: "token_a",
};

const swimmerB: MemoryActor = {
  role: "swimmer",
  name: "Kavi",
  swimmerId: "11111111-1111-1111-1111-111111111102",
  swimmerToken: "token_b",
};

describe("Squad Memories Service", () => {
  beforeEach(() => {
    DataStore.resetToDemo();
  });

  it("validates memory dates strictly", () => {
    expect(isValidMemoryDate("2026-05-10")).toBe(true);
    expect(isValidMemoryDate("2026-02-30")).toBe(false); // Invalid calendar day
    expect(isValidMemoryDate("2026-13-01")).toBe(false);
    expect(isValidMemoryDate("21-11-2026")).toBe(false);
    expect(isValidMemoryDate("2099-01-01")).toBe(false); // Far future rejected
  });

  it("detects real image magic bytes and rejects spoofed non-images", () => {
    expect(detectImageMimeFromBytes(FAKE_JPEG)).toBe("image/jpeg");
    expect(detectImageMimeFromBytes(FAKE_PNG)).toBe("image/png");
    expect(detectImageMimeFromBytes(FAKE_WEBP)).toBe("image/webp");
    expect(detectImageMimeFromBytes(Buffer.from("<svg><script>alert(1)</script></svg>"))).toBe(
      null
    );
    expect(detectImageMimeFromBytes(Buffer.from("plain text"))).toBe(null);
  });

  it("enforces the strict 1–3 photos per date limit across coach and swimmers", async () => {
    // Swimmer A uploads 2 photos for a date
    const first = await addPhotosToMemoryDate({
      actor: swimmerA,
      memoryDate: "2026-05-10",
      title: "Post-Swim Coffee",
      location: "Barista Cafe",
      files: [
        { buffer: FAKE_JPEG, mimeType: "image/jpeg", width: 1200, height: 900 },
        { buffer: FAKE_WEBP, mimeType: "image/webp", width: 1200, height: 900 },
      ],
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.memory.photos).toHaveLength(2);
    expect(first.memory.photos.map((p) => p.slot)).toEqual([1, 2]);

    // Swimmer B tries to add 2 more -> blocked because only 1 slot left
    const overLimit = await addPhotosToMemoryDate({
      actor: swimmerB,
      memoryDate: "2026-05-10",
      files: [
        { buffer: FAKE_PNG, mimeType: "image/png" },
        { buffer: FAKE_JPEG, mimeType: "image/jpeg" },
      ],
    });
    expect(overLimit.ok).toBe(false);
    if (!overLimit.ok) {
      expect(overLimit.status).toBe(409);
    }

    // Swimmer B adds 1 photo -> fills slot #3 cleanly
    const third = await addPhotosToMemoryDate({
      actor: swimmerB,
      memoryDate: "2026-05-10",
      files: [{ buffer: FAKE_PNG, mimeType: "image/png" }],
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.memory.photos).toHaveLength(3);
    expect(third.memory.photos.map((p) => p.slot)).toEqual([1, 2, 3]);

    // Admin tries adding a 4th photo -> blocked (3/3 full)
    const fourth = await addPhotosToMemoryDate({
      actor: adminActor,
      memoryDate: "2026-05-10",
      files: [{ buffer: FAKE_JPEG, mimeType: "image/jpeg" }],
    });
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.status).toBe(409);
    }
  });

  it("enforces photo ownership on delete, compacts slots, and promotes cover photo", async () => {
    const res = await addPhotosToMemoryDate({
      actor: swimmerA,
      memoryDate: "2026-05-12",
      title: "Weekend Hangout",
      files: [
        { buffer: FAKE_JPEG, mimeType: "image/jpeg" },
        { buffer: FAKE_WEBP, mimeType: "image/webp" },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const memId = res.memory.id;
    const [photo1, photo2] = res.memory.photos;

    // Swimmer B cannot delete Swimmer A's photo
    const forbidden = await deleteMemoryOrPhoto({
      actor: swimmerB,
      memoryId: memId,
      photoId: photo1.id,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.status).toBe(403);

    // Admin promotes photo2 to cover (slot 1)
    const promoted = await updateMemoryDetails({
      actor: adminActor,
      memoryId: memId,
      coverPhotoId: photo2.id,
    });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.memory.photos[0].id).toBe(photo2.id);
    expect(promoted.memory.photos[0].slot).toBe(1);

    // Swimmer A deletes their own photo (photo2) -> slot compacts to [1]
    const deletedOne = await deleteMemoryOrPhoto({
      actor: swimmerA,
      memoryId: memId,
      photoId: photo2.id,
    });
    expect(deletedOne.ok).toBe(true);
    if (!deletedOne.ok) return;
    expect(deletedOne.deletedMemory).toBe(false);
    expect(deletedOne.memory?.photos).toHaveLength(1);
    expect(deletedOne.memory?.photos[0].slot).toBe(1);

    // Deleting the last remaining photo removes the empty memory day automatically
    const deletedLast = await deleteMemoryOrPhoto({
      actor: swimmerA,
      memoryId: memId,
      photoId: photo1.id,
    });
    expect(deletedLast.ok).toBe(true);
    if (!deletedLast.ok) return;
    expect(deletedLast.deletedMemory).toBe(true);
    expect(DataStore.getMemoryById(memId)).toBeNull();
  });
});
