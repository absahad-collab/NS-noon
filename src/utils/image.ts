export function shrinkImage(
  file: File,
  done: (dataUrl: string) => void,
  fail: () => void
): void {
  const fr = new FileReader();
  fr.onerror = () => fail();
  fr.onload = () => {
    const im = new Image();
    im.onerror = () => fail();
    im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      const ctx = c.getContext('2d');
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(im, 0, 0, c.width, c.height);
      done(c.toDataURL('image/jpeg', 0.8));
    };
    im.src = String(fr.result || '');
  };
  fr.readAsDataURL(file);
}
