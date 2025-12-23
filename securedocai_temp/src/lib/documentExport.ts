import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';

interface ParsedSlide {
  title: string;
  bullets: string[];
  notes: string;
}

function parseMarkdownToPdfElements(content: string): { type: 'h1' | 'h2' | 'h3' | 'bullet' | 'text'; text: string }[] {
  const lines = content.split('\n');
  const elements: { type: 'h1' | 'h2' | 'h3' | 'bullet' | 'text'; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      elements.push({ type: 'h3', text: trimmed.substring(4) });
    } else if (trimmed.startsWith('## ')) {
      elements.push({ type: 'h2', text: trimmed.substring(3) });
    } else if (trimmed.startsWith('# ')) {
      elements.push({ type: 'h1', text: trimmed.substring(2) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push({ type: 'bullet', text: trimmed.substring(2) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push({ type: 'bullet', text: trimmed });
    } else {
      elements.push({ type: 'text', text: trimmed });
    }
  }

  return elements;
}

function parsePresentationSlides(content: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  const sections = content.split(/(?=^## )/gm);

  for (const section of sections) {
    if (!section.trim()) continue;

    const lines = section.split('\n');
    let title = '';
    const bullets: string[] = [];
    let notes = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('## ')) {
        title = trimmed.substring(3).replace(/^Slide\s*\d+:\s*/i, '');
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        bullets.push(trimmed.substring(2));
      } else if (trimmed.startsWith('*') && trimmed.endsWith('*') && trimmed.length > 2) {
        notes = trimmed.slice(1, -1);
      } else if (trimmed.toLowerCase().startsWith('speaker notes:')) {
        notes = trimmed.substring(14).trim();
      }
    }

    if (title || bullets.length > 0) {
      slides.push({ title, bullets, notes });
    }
  }

  return slides;
}

export function exportAsPdf(title: string, content: string, documentType: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Title page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, pageWidth / 2, pageHeight / 3, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const typeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1);
  doc.text(typeLabel, pageWidth / 2, pageHeight / 3 + 20, { align: 'center' });
  doc.text(new Date().toLocaleDateString(), pageWidth / 2, pageHeight / 3 + 30, { align: 'center' });

  // Content pages
  doc.addPage();
  y = margin;
  doc.setTextColor(0);

  const elements = parseMarkdownToPdfElements(content);

  for (const element of elements) {
    switch (element.type) {
      case 'h1':
        addNewPageIfNeeded(20);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        y += 10;
        doc.text(element.text, margin, y);
        y += 10;
        break;

      case 'h2':
        addNewPageIfNeeded(16);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        y += 8;
        doc.text(element.text, margin, y);
        y += 8;
        break;

      case 'h3':
        addNewPageIfNeeded(12);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        y += 6;
        doc.text(element.text, margin, y);
        y += 6;
        break;

      case 'bullet':
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const bulletText = `• ${element.text}`;
        const bulletLines = doc.splitTextToSize(bulletText, maxWidth - 10);
        addNewPageIfNeeded(bulletLines.length * 6);
        doc.text(bulletLines, margin + 5, y);
        y += bulletLines.length * 6;
        break;

      case 'text':
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const textLines = doc.splitTextToSize(element.text, maxWidth);
        addNewPageIfNeeded(textLines.length * 6);
        doc.text(textLines, margin, y);
        y += textLines.length * 6 + 2;
        break;
    }
  }

  // Add page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`${title}.pdf`);
}

export function exportAsPptx(title: string, content: string): void {
  const pptx = new pptxgen();
  
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = title;
  pptx.author = 'SecureDoc AI';

  // Title slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(title, {
    x: 0.5,
    y: 2.5,
    w: '90%',
    h: 1.5,
    fontSize: 36,
    bold: true,
    align: 'center',
    color: '363636',
  });
  titleSlide.addText(new Date().toLocaleDateString(), {
    x: 0.5,
    y: 4.2,
    w: '90%',
    h: 0.5,
    fontSize: 14,
    align: 'center',
    color: '666666',
  });

  // Parse and create content slides
  const slides = parsePresentationSlides(content);

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    // Slide title
    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.4,
        w: '90%',
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: '363636',
      });
    }

    // Bullet points
    if (slideData.bullets.length > 0) {
      const bulletContent = slideData.bullets.map(b => ({
        text: b,
        options: { bullet: true, fontSize: 18, color: '404040' as const },
      }));

      slide.addText(bulletContent, {
        x: 0.5,
        y: 1.5,
        w: '90%',
        h: 4,
        valign: 'top',
      });
    }

    // Speaker notes
    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }
  }

  // Add slide numbers
  pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    slideNumber: { x: '95%', y: '95%', fontSize: 10, color: '666666' },
  });

  pptx.writeFile({ fileName: `${title}.pptx` });
}

export function exportAsText(title: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
