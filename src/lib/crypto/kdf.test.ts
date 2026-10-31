import { describe, expect, it } from "vitest";
import { hkdfSync } from "node:crypto";
import { deriveBackupKek } from "./kdf";
import type { BackupKeyBytes } from "./errors";

// Known-answer test for KEK_backup (design.md requires the KAT against
// node:crypto.hkdfSync). deriveBackupKek returns a NON-EXTRACTABLE AES-256-GCM
// CryptoKey, so its raw bits cannot be read back out. Instead we compute the
// expected 32 key bytes independently with hkdfSync, import THAT as an AES-GCM
// key, and prove the two keys are byte-for-byte identical by showing their
// wrap behaviour is interchangeable: a ciphertext produced under the module's
// key decrypts under the independent key, and vice versa. AES-GCM is
// authenticated, so a single matching decrypt rules out any key difference.

/** Fixed, non-secret test vectors (deterministic, not from any real letter). */
const BACKUP_KEY = Uint8Array.from(
  Array.from({ length: 16 }, (_, i) => i + 1),
) as BackupKeyBytes; // 01 02 ... 10
const SERVER_SECRET = Uint8Array.from(
  Array.from({ length: 32 }, (_, i) => 0x20 + i),
); // 20 21 ... 3f
const LETTER_ID = Uint8Array.from(
  Array.from({ length: 16 }, (_, i) => 0xa0 + i),
); // a0 a1 ... af

const INFO_KEK_BACKUP = "revenant-kek-backup-v1";

/** Concatenate byte arrays into one fresh ArrayBuffer-backed view. */
const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
};

/**
 * Copy bytes into a fresh ArrayBuffer-backed view. WebCrypto's typings want a
 * BufferSource whose buffer is an ArrayBuffer, not a possibly-shared
 * ArrayBufferLike (hkdfSync returns the latter), so the copy pins the type.
 */
const toArrayBufferView = (bytes: ArrayBufferView): Uint8Array<ArrayBuffer> => {
  const src = new Uint8Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  );
  const out = new Uint8Array(src.length);
  out.set(src);
  return out;
};

/**
 * Independently derive the 32 KEK bytes with node:crypto HKDF-SHA256, matching
 * deriveBackupKek: ikm = backupKey ‖ serverSecret, salt = letterId, info.
 */
function expectedKekBytes(): Uint8Array<ArrayBuffer> {
  const ikm = concat(BACKUP_KEY, SERVER_SECRET);
  const derived = hkdfSync("sha256", ikm, LETTER_ID, INFO_KEK_BACKUP, 32);
  return toArrayBufferView(new Uint8Array(derived));
}

describe("deriveBackupKek known-answer test (vs node:crypto hkdfSync)", () => {
  it("derives the same AES-256-GCM key as an independent HKDF-SHA256", async () => {
    const subtle = globalThis.crypto.subtle;

    // The module's key (non-extractable) and the independent reference key.
    const moduleKey = await deriveBackupKek(BACKUP_KEY, SERVER_SECRET, LETTER_ID);
    const refBytes = expectedKekBytes();
    const refKey = await subtle.importKey(
      "raw",
      refBytes,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );

    const iv = new Uint8Array(12).fill(7);
    const plaintext = new TextEncoder().encode("revenant-kat-plaintext");

    // Encrypt under the module key, decrypt under the reference key. A match
    // proves the two derived keys are byte-for-byte identical.
    const ctFromModule = await subtle.encrypt(
      { name: "AES-GCM", iv },
      moduleKey,
      plaintext,
    );
    const back = await subtle.decrypt(
      { name: "AES-GCM", iv },
      refKey,
      ctFromModule,
    );
    expect(new Uint8Array(back)).toEqual(plaintext);

    // And the reverse direction, for completeness.
    const ctFromRef = await subtle.encrypt(
      { name: "AES-GCM", iv },
      refKey,
      plaintext,
    );
    const back2 = await subtle.decrypt(
      { name: "AES-GCM", iv },
      moduleKey,
      ctFromRef,
    );
    expect(new Uint8Array(back2)).toEqual(plaintext);
  });

  it("changing the salt (letter ID) yields a different key", async () => {
    const subtle = globalThis.crypto.subtle;
    const moduleKey = await deriveBackupKek(BACKUP_KEY, SERVER_SECRET, LETTER_ID);

    // Reference key derived with a DIFFERENT salt; it must NOT decrypt the
    // module key's ciphertext (the keys differ).
    const otherLetterId = Uint8Array.from(
      Array.from({ length: 16 }, (_, i) => 0xb0 + i),
    );
    const refBytes = toArrayBufferView(
      new Uint8Array(
        hkdfSync(
          "sha256",
          concat(BACKUP_KEY, SERVER_SECRET),
          otherLetterId,
          INFO_KEK_BACKUP,
          32,
        ),
      ),
    );
    const refKey = await subtle.importKey(
      "raw",
      refBytes,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const iv = new Uint8Array(12).fill(7);
    const ct = await subtle.encrypt(
      { name: "AES-GCM", iv },
      moduleKey,
      new TextEncoder().encode("x"),
    );
    await expect(
      subtle.decrypt({ name: "AES-GCM", iv }, refKey, ct),
    ).rejects.toThrow();
  });

  it("rejects wrong-length inputs before deriving", async () => {
    await expect(
      deriveBackupKek(
        new Uint8Array(15) as BackupKeyBytes,
        SERVER_SECRET,
        LETTER_ID,
      ),
    ).rejects.toThrow();
    await expect(
      deriveBackupKek(BACKUP_KEY, new Uint8Array(31), LETTER_ID),
    ).rejects.toThrow();
    await expect(
      deriveBackupKek(BACKUP_KEY, SERVER_SECRET, new Uint8Array(15)),
    ).rejects.toThrow();
  });
});
