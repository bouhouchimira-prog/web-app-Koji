// Fichier choisi dans le navigateur → data URL prête à envoyer. Vercel
// refuse les requêtes de plus de 4,5 Mo : une photo est réduite à
// 2 000 px en JPEG, un PDF doit faire 3 Mo au plus.
export const PDF_MAX = 3 * 1024 * 1024;

const lireDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(new Error("Lecture du fichier impossible."));
  r.onload = () => resolve(String(r.result || ""));
  r.readAsDataURL(file);
});

export async function fichierPourEnvoi(file, { cote = 2000, qualite = 0.85 } = {}) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > PDF_MAX) throw new Error(`${file.name} : PDF trop lourd (3 Mo au plus).`);
    return lireDataUrl(file);
  }
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} : choisissez une photo ou un PDF.`);
  const source = await lireDataUrl(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error(`${file.name} : image illisible (format HEIC ? prenez la photo en JPEG).`));
    img.onload = () => resolve(img);
    img.src = source;
  });
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * echelle));
  canvas.height = Math.max(1, Math.round(image.height * echelle));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", qualite);
}
