import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { removeNonWidgetAnnotations } from '../js/utils/pdf-annotations';

describe('PDF annotation removal', () => {
  it('removes content annotations while preserving form widgets', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([300, 200]);
    const form = document.getForm();
    const field = form.createTextField('customer_name');
    field.addToPage(page, { x: 20, y: 120, width: 180, height: 30 });

    const link = document.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [20, 20, 120, 50],
    });
    page.node.addAnnot(document.context.register(link));

    expect(page.node.Annots()?.size()).toBe(2);
    expect(removeNonWidgetAnnotations(document)).toBe(1);

    const annotations = page.node.Annots();
    expect(annotations?.size()).toBe(1);
    const remaining = annotations?.lookup(0, PDFDict);
    expect(remaining?.lookup(PDFName.of('Subtype'), PDFName).asString()).toBe(
      '/Widget'
    );

    const reloaded = await PDFDocument.load(await document.save());
    expect(reloaded.getForm().getFields()).toHaveLength(1);
  });
});
