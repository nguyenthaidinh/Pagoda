import { getPDFDocument } from './helpers.js';

export function isPdfPasswordProtected(bytes: ArrayBuffer): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const task = getPDFDocument({ data: bytes.slice(0) });

    const finish = (isProtected: boolean) => {
      if (settled) return;
      settled = true;
      resolve(isProtected);
    };

    task.onPassword = () => {
      finish(true);
      task.destroy().catch(() => {});
    };

    task.promise
      .then(async (doc) => {
        await doc.destroy();
        finish(false);
      })
      .catch(() => finish(false));
  });
}
