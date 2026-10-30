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
  renumberSections,
  insertSection,
  insertSubsection,
  insertLeafElement,
  updateCanvasItem,
  removeCanvasItem,
  findCanvasItemLocation,
} from "../../src/services/canvasLayoutService";
import {
  createDefaultCanvasDocument,
  createDefaultSection,
  createDefaultSubsection,
} from "../../src/utils/canvasDefaults";

describe("DocumentCanvas AST Tree & Layout Engine", () => {
  it("creates a well-formed default AST document structure", () => {
    const doc = createDefaultCanvasDocument("node-alpha");
    expect(doc).toBeDefined();
    expect(doc.nodeId).toBe("node-alpha");
    expect(Array.isArray(doc.sections)).toBe(true);
    expect(doc.version).toBeGreaterThanOrEqual(1);
    expect(doc.sections.length).toBeGreaterThanOrEqual(0);
  });

  it("validates type guards across AST hierarchy (section -> subsection -> leaf)", () => {
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
      elements: [textLeaf, photoLeaf, galleryLeaf, chartLeaf],
    };

    const section: SectionElement = {
      id: "sec-1",
      type: "section",
      title: "Foundational Access",
      number: "01",
      elements: [subsection],
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

  it("renumbers sections sequentially with zero-padded formatting", () => {
    const rawSections: SectionElement[] = [
      { id: "s1", type: "section", title: "First", number: "99", elements: [] },
      { id: "s2", type: "section", title: "Second", number: "00", elements: [] },
      { id: "s3", type: "section", title: "Third", number: "12", elements: [] },
    ];

    const renumbered = renumberSections(rawSections);
    expect(renumbered[0].number).toBe("01");
    expect(renumbered[1].number).toBe("02");
    expect(renumbered[2].number).toBe("03");
  });

  it("inserts, finds, updates, and removes AST nodes deterministically", () => {
    let doc: NodeCanvasDocument = {
      nodeId: "test-node",
      version: 2,
      updatedAt: new Date().toISOString(),
      sections: [],
    };

    // 1. Insert Section
    const newSection = createDefaultSection(1, "test-node");
    newSection.title = "Foundations";
    doc = insertSection(doc, newSection);
    expect(doc.sections).toHaveLength(1);
    const secId = doc.sections[0].id;
    expect(doc.sections[0].title).toBe("Foundations");
    expect(doc.sections[0].number).toBe("01");

    // 2. Insert Subsection
    const newSub = createDefaultSubsection("test-node");
    newSub.title = "Core Indicators";
    doc = insertSubsection(doc, secId, newSub);
    const subId = (doc.sections[0].elements[0] as SubsectionElement).id;
    expect(subId).toBeDefined();

    // 3. Insert Leaf Block (Text)
    const textBlock: TextElement = {
      id: "tb-101",
      type: "text",
      pointId: "point-tb-101",
      content: "Evidence based progress narrative.",
    };
    doc = insertLeafElement(doc, secId, textBlock, undefined, subId);

    // 4. Find location
    const loc = findCanvasItemLocation(doc, "tb-101");
    expect(loc).not.toBeNull();
    expect(loc?.sectionId).toBe(secId);
    expect(loc?.subsectionId).toBe(subId);

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
});
