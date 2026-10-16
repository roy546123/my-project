import os
from pathlib import Path
import re
import subprocess
import tempfile

from PIL import Image, ImageOps


def parse_text(text):
    """Conservative candidates. Only explicitly labelled KRW totals become amounts."""
    rows = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    pattern = re.compile(r"\b(QLD|TQQQ|UPRO|SOXL|USD|SSO|XLK|SPMO|SGOV|FAS|LABU|FNGU|TNA)\b")
    for i, line in enumerate(lines):
        match = pattern.search(line.upper())
        if not match:
            continue
        block = [line]
        for following in lines[i + 1:i + 6]:
            if pattern.search(following.upper()):
                break
            block.append(following)
        context = "\n".join(block)
        amount = None
        for item in block:
            if re.search(r"매수금액|거래금액|체결금액|총\s*금액|amount|total", item, re.I):
                won = re.search(r"(?:₩|KRW)\s*([\d,]+)|([\d,]+)\s*원", item, re.I)
                if won:
                    amount = int((won[1] or won[2]).replace(",", ""))
        qty = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:주|shares)\b", context, re.I)
        rows.append(dict(ticker=match[1], amount=amount,
                         quantity=float(qty[1].replace(",", "")) if qty else None))
    return rows


def recognize(content, tessdata):
    with tempfile.TemporaryDirectory(prefix="invest-ocr-") as tmp:
        path = Path(tmp) / "scan.png"
        Image.MAX_IMAGE_PIXELS = 20_000_000
        with Image.open(__import__('io').BytesIO(content)) as image:
            if image.width * image.height > 20_000_000:
                raise ValueError("이미지는 2,000만 화소 이하로 올려 주세요.")
            image = ImageOps.exif_transpose(image).convert("RGB")
            # Normalize dark brokerage screens to a light background for OCR.
            gray = ImageOps.grayscale(image)
            if sum(gray.resize((1, 1)).getdata()) < 110:
                gray = ImageOps.invert(gray)
            if gray.width < 1600:
                ratio = min(2, 1600 / gray.width)
                gray = gray.resize((int(gray.width * ratio), int(gray.height * ratio)))
            gray.save(path)
        cmd = ["tesseract", str(path), "stdout", "-l", "kor+eng", "--psm", "6"]
        if (Path(tessdata) / "kor.traineddata").exists():
            cmd += ["--tessdata-dir", str(tessdata)]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=45,
                                env={**os.environ, "OMP_THREAD_LIMIT": "2"})
        if result.returncode:
            raise ValueError("OCR 실행에 실패했습니다. Tesseract와 한국어 인식 모델 설치를 확인해 주세요.")
        text = result.stdout.strip()
        if not text:
            raise ValueError("읽을 수 있는 문자가 없습니다. 글자가 선명한 이미지를 올려 주세요.")
        return {"text": text, "candidates": parse_text(text)}
