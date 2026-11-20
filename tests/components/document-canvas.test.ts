import { describe, it, expect } from "vitest";
import {
  isSectionElement,
  isSubsectionElement,
  isLeafElement,
  isTextElement,
  isPhotoElement,
  isGalleryElement,
  isChartElement,
  type NodeCanvasDocument,
  type SectionElement,
  type SubsectionElement,
  type TextElement,
  type PhotoElement,
  type GalleryElement,
  type ChartElement,
} from "../../src/types/canvas";
import {
  renumberCanvasElements,
  insertSection,
  insertSubsection,
  insertLeafElement,
  moveCanvasItem,
  relocateCanvasItem,
  updateCanvasItem,
  removeCanvasItem,
  findCanvasItemLocation,
} from "../../src/services/canvasLayoutService";
import {
  createDefaultCanvasDocument,
  createDefaultSection,
  createDefaultSubsection,
  normalizeCanvasDocument,
} from "../../src/utils/canvasDefaults";

describe("DocumentCanvas AST Tree & Layout Engine", () => {
  it("creates a well-formed default AST document structure", () => {
    const doc = createDefaultCanvasDocument("node-alpha");
    expect(doc).toBeDefined();
    expect(doc.nodeId).toBe("node-alpha");
    expect(Array.isArray(doc.elements)).toBe(true);
    expect(doc.version).toBe(3);
    expect(doc.elements.length).toBe(0);
  });

  it("validates type guards across flat AST elements", () => {
    const textLeaf: TextElement = {
      id: "leaf-text-1",
      type: "text",
      pointId: "point-text-1",
      content: "Deep-dive narrative content.",
    };

    const photoLeaf: PhotoElement = {
      id: "leaf-photo-1",
      type: "photo",
      pointId: "point-photo-1",
      src: "https://images.unsplash.com/photo-1544717305-2782549b5136",
      alt: "Academic research campus",
      caption: "Main research hall",
    };

    const galleryLeaf: GalleryElement = {
      id: "leaf-gal-1",
      type: "gallery",
      pointId: "point-gal-1",
    };

    const chartLeaf: ChartElement = {
      id: "leaf-chart-1",
      type: "chart",
      chartId: "chart-enrollment-trend",
      title: "Enrollment Performance",
    };

    const subsection: SubsectionElement = {
      id: "sub-1",
      type: "subsection",
      title: "Operational Metric",
    };

    const section: SectionElement = {
      id: "sec-1",
      type: "section",
      title: "Foundational Access",
      number: "01",
    };

    // Test Type Guards
    expect(isSectionElement(section)).toBe(true);
    expect(isSectionElement(subsection)).toBe(false);

    expect(isSubsectionElement(subsection)).toBe(true);
    expect(isSubsectionElement(section)).toBe(false);

    expect(isLeafElement(textLeaf)).toBe(true);
    expect(isLeafElement(photoLeaf)).toBe(true);
    expect(isLeafElement(galleryLeaf)).toBe(true);
    expect(isLeafElement(chartLeaf)).toBe(true);
    expect(isLeafElement(section)).toBe(false);
    expect(isLeafElement(subsection)).toBe(false);

    expect(isTextElement(textLeaf)).toBe(true);
    expect(isPhotoElement(photoLeaf)).toBe(true);
    expect(isGalleryElement(galleryLeaf)).toBe(true);
    expect(isChartElement(chartLeaf)).toBe(true);
  });

  it("renumbers sections sequentially with zero-padded formatting across flat elements", () => {
    const rawElements = [
      { id: "t0", type: "text" as const, pointId: "p0", content: "Preamble" },
      { id: "s1", type: "section" as const, title: "First", number: "99" },
      { id: "sub1", type: "subsection" as const, title: "Sub" },
      { id: "s2", type: "section" as const, title: "Second", number: "00" },
      { id: "s3", type: "section" as const, title: "Third", number: "12" },
    ];

    const renumbered = renumberCanvasElements(rawElements);
    expect((renumbered[1] as SectionElement).number).toBe("01");
    expect((renumbered[3] as SectionElement).number).toBe("02");
    expect((renumbered[4] as SectionElement).number).toBe("03");
  });

  it("inserts, finds, updates, and removes AST nodes deterministically", () => {
    let doc: NodeCanvasDocument = createDefaultCanvasDocument("test-node");

    // 1. Insert Section
    const newSection = createDefaultSection(1, "test-node");
    newSection.title = "Foundations";
    doc = insertSection(doc, newSection);
    expect(doc.elements).toHaveLength(1);
    const secId = doc.elements[0].id;
    expect(secId).toBeDefined();
    expect((doc.elements[0] as SectionElement).title).toBe("Foundations");
    expect((doc.elements[0] as SectionElement).number).toBe("01");

    // 2. Insert Subsection
    const newSub = createDefaultSubsection("test-node");
    newSub.title = "Core Indicators";
    doc = insertSubsection(doc, newSub);
    const subId = doc.elements[1].id;
    expect(subId).toBeDefined();

    // 3. Insert Leaf Block (Text)
    const textBlock: TextElement = {
      id: "tb-101",
      type: "text",
      pointId: "point-tb-101",
      content: "Evidence based progress narrative.",
    };
    doc = insertLeafElement(doc, textBlock);

    // 4. Find location
    const loc = findCanvasItemLocation(doc, "tb-101");
    expect(loc).not.toBeNull();
    expect(loc?.index).toBe(2);
    expect(loc?.kind).toBe("leaf");

    // 5. Update Leaf Block
    doc = updateCanvasItem(doc, "tb-101", {
      content: "Updated narrative string.",
    });
    const updatedLoc = findCanvasItemLocation(doc, "tb-101");
    expect((updatedLoc?.item as TextElement).content).toBe("Updated narrative string.");

    // 6. Remove Leaf Block
    doc = removeCanvasItem(doc, "tb-101");
    expect(findCanvasItemLocation(doc, "tb-101")).toBeNull();
  });

  it("removes ONLY the section or subsection heading so lower content merges upward (including last section)", () => {
    let doc: NodeCanvasDocument = {
      nodeId: "test-node",
      version: 3,
      updatedAt: new Date().toISOString(),
      elements: [
        { id: "sec-1", type: "section", title: "Section 1", number: "01" },
        { id: "txt-1", type: "text", pointId: "p1", content: "Under section 1" },
        { id: "sub-1", type: "subsection", title: "Sub 1" },
        { id: "txt-2", type: "text", pointId: "p2", content: "Under sub 1" },
      ],
    };

    // Delete subsection heading -> txt-2 merges upward under sec-1
    doc = removeCanvasItem(doc, "sub-1");
    expect(doc.elements.map((e) => e.id)).toEqual(["sec-1", "txt-1", "txt-2"]);

    // Delete the last section heading -> txt-1 and txt-2 remain at top level
    doc = removeCanvasItem(doc, "sec-1");
    expect(doc.elements.map((e) => e.id)).toEqual(["txt-1", "txt-2"]);
  });

  it("moves and relocates section/subsection headings individually and renumbers sections", () => {
    let doc: NodeCanvasDocument = {
      nodeId: "test-node",
      version: 3,
      updatedAt: new Date().toISOString(),
      elements: [
        { id: "sec-1", type: "section", title: "Section 1", number: "01" },
        { id: "txt-1", type: "text", pointId: "p1", content: "Text 1" },
        { id: "sec-2", type: "section", title: "Section 2", number: "02" },
      ],
    };

    doc = moveCanvasItem(doc, "sec-1", "down");
    expect(doc.elements.map((e) => e.id)).toEqual(["txt-1", "sec-1", "sec-2"]);

    doc = relocateCanvasItem(doc, "sec-2", "test-node", 0);
    expect(doc.elements.map((e) => e.id)).toEqual(["sec-2", "txt-1", "sec-1"]);
    expect((doc.elements[0] as SectionElement).number).toBe("01");
    expect((doc.elements[2] as SectionElement).number).toBe("02");
  });

  it("auto-migrates legacy v2 nested sections trees into flat v3 elements via normalizeCanvasDocument", () => {
    const legacyDoc = {
      nodeId: "legacy-node",
      version: 2,
      updatedAt: "2026-01-01T00:00:00.000Z",
      sections: [
        {
          id: "sec-1",
          type: "section",
          title: "Overview",
          elements: [
            { id: "txt-1", type: "text", pointId: "p1", content: "Intro" },
            {
              id: "sub-1",
              type: "subsection",
              title: "Details",
              elements: [
                { id: "txt-2", type: "text", pointId: "p2", content: "Nested detail" },
              ],
            },
          ],
        },
      ],
    };

    const migrated = normalizeCanvasDocument(legacyDoc);
    expect(migrated.version).toBe(3);
    expect(migrated.elements.map((e) => e.id)).toEqual(["sec-1", "txt-1", "sub-1", "txt-2"]);
  });
});
