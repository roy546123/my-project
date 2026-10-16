import { createWorker, OEM, PSM } from "tesseract.js";

export async function recognizeImage(file) {
  const image = await createImageBitmap(file);
  if (image.width * image.height > 20000000) {
    image.close();
    throw new Error("이미지는 2,000만 화소 이하로 올려 주세요.");
  }
  image.close();
  const base = new URL("ocr/", document.baseURI).href;
  const worker = await createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base,
    gzip: false,
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const { data } = await worker.recognize(file);
    if (!data.text.trim())
      throw new Error(
        "읽을 수 있는 문자가 없습니다. 글자가 선명한 이미지를 올려 주세요.",
      );
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
