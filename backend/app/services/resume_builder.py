"""PDF rendering for the editable resume builder payload."""
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer


def _register_font() -> str:
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("C:/Windows/Fonts/arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            pdfmetrics.registerFont(TTFont("ResumeSans", str(path)))
            return "ResumeSans"
    return "Helvetica"


def _text(value: Any) -> str:
    return escape(str(value or "").strip())


def _link(label: str, url: str) -> str:
    clean_url = str(url or "").strip()
    if not clean_url:
        return ""
    href = clean_url if clean_url.startswith(("http://", "https://", "mailto:", "tel:")) else ""
    return f'<link href="{escape(href, quote=True)}">{_text(label or clean_url)}</link>' if href else _text(label or clean_url)


def build_resume_pdf(content: dict[str, Any], template: str = "classic") -> bytes:
    font_name = _register_font()
    personal = content.get("personal") or {}
    accent = colors.HexColor("#65764f" if template == "classic" else "#245b75")
    dark = colors.HexColor("#252525")
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle("ResumeName", parent=styles["Title"], fontName=font_name, fontSize=22, leading=26, alignment=TA_CENTER, textColor=dark, spaceAfter=5)
    contact_style = ParagraphStyle("ResumeContact", parent=styles["Normal"], fontName=font_name, fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=colors.HexColor("#555555"), spaceAfter=10)
    section_style = ParagraphStyle("ResumeSection", parent=styles["Heading2"], fontName=font_name, fontSize=10.5, leading=13, textColor=accent, spaceBefore=11, spaceAfter=4, uppercase=True)
    body_style = ParagraphStyle("ResumeBody", parent=styles["BodyText"], fontName=font_name, fontSize=9, leading=12, textColor=dark, spaceAfter=3)
    small_style = ParagraphStyle("ResumeSmall", parent=body_style, fontSize=8.5, leading=11)
    bullet_style = ParagraphStyle("ResumeBullet", parent=body_style, leftIndent=13, firstLineIndent=-8, bulletIndent=0, spaceAfter=2)
    title_style = ParagraphStyle("ResumeTitle", parent=body_style, fontSize=9.5, leading=12, spaceAfter=1)

    story = []
    name = _text(personal.get("full_name")) or "Untitled Resume"
    story.append(Paragraph(name, name_style))
    contact_parts = []
    for key in ("email", "phone", "location"):
        if personal.get(key):
            contact_parts.append(_text(personal[key]))
    for key, label in (("linkedin_url", "LinkedIn"), ("github_url", "GitHub"), ("portfolio_url", "Portfolio")):
        if personal.get(key):
            contact_parts.append(_link(label, personal[key]))
    if contact_parts:
        story.append(Paragraph(" &nbsp;|&nbsp; ".join(contact_parts), contact_style))
    story.append(HRFlowable(width="100%", thickness=0.7, color=accent, spaceAfter=4))

    def section(title: str) -> None:
        story.append(Paragraph(title, section_style))

    def bullets(items: list[Any]) -> None:
        for item in items:
            value = _text(item)
            if value:
                story.append(Paragraph(f"&#8226;&nbsp; {value}", bullet_style))

    if content.get("summary"):
        section("Professional Summary")
        story.append(Paragraph(_text(content["summary"]).replace("\n", "<br/>"), body_style))

    if content.get("skills"):
        section("Technical Skills")
        story.append(Paragraph(_text(" | ".join(str(skill) for skill in content["skills"])), body_style))

    for heading, entries, kind in (("Experience", content.get("experience"), "experience"), ("Projects", content.get("projects"), "project")):
        if not entries:
            continue
        section(heading)
        for item in entries:
            if kind == "experience":
                title = " - ".join(part for part in (_text(item.get("title")), _text(item.get("company"))) if part)
                meta = " | ".join(part for part in (_text(item.get("location")), _text(item.get("dates"))) if part)
                if title:
                    story.append(Paragraph(f"<b>{title}</b>", title_style))
                if meta:
                    story.append(Paragraph(meta, small_style))
                bullets(item.get("bullets", []))
            else:
                title = _text(item.get("name"))
                tech = ", ".join(str(value) for value in item.get("technologies", []) if str(value).strip())
                if title:
                    story.append(Paragraph(f"<b>{title}</b>{f' | {_text(tech)}' if tech else ''}", title_style))
                if item.get("description"):
                    story.append(Paragraph(_text(item["description"]), body_style))
                bullets(item.get("contributions", []) + item.get("results", []))

    if content.get("education"):
        section("Education")
        for item in content["education"]:
            title = " - ".join(part for part in (_text(item.get("degree")), _text(item.get("institution"))) if part)
            meta = " | ".join(part for part in (_text(item.get("specialization")), _text(item.get("dates")), _text(item.get("grade"))) if part)
            if title:
                story.append(Paragraph(f"<b>{title}</b>", title_style))
            if meta:
                story.append(Paragraph(meta, small_style))
            if item.get("coursework"):
                story.append(Paragraph(f"Coursework: {_text(item['coursework'])}", small_style))

    if content.get("certifications"):
        section("Certifications")
        bullets([" - ".join(part for part in (_text(item.get("name")), _text(item.get("issuer")), _text(item.get("date"))) if part) for item in content["certifications"]])
    if content.get("achievements"):
        section("Achievements")
        bullets(content["achievements"])
    if content.get("activities"):
        section("Leadership & Activities")
        bullets(content["activities"])

    buffer = BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=0.62 * inch, leftMargin=0.62 * inch, topMargin=0.55 * inch, bottomMargin=0.55 * inch, title=name)
    document.build(story)
    return buffer.getvalue()