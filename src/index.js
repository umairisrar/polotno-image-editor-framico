import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from "polotno";
import { Toolbar } from "polotno/toolbar/toolbar";
import { PagesTimeline } from "polotno/pages-timeline";
import { ZoomButtons } from "polotno/toolbar/zoom-buttons";
import { SidePanel } from "polotno/side-panel";
import { Workspace } from "polotno/canvas/workspace";
import {
  Button,
  ButtonGroup,
  Popover,
  NumericInput,
  Radio,
  RadioGroup,
  Slider,
  Divider,
} from "@blueprintjs/core";
import { SketchPicker } from "react-color";

import "@blueprintjs/core/lib/css/blueprint.css";

import { createStore } from "polotno/model/store";
import { unstable_registerShapeModel, setTransformerStyle, unstable_setSnapFilterFunc } from 'polotno/config';

let forCanvasSelectedOption = "none"
// Define DPI constant (300 is standard print quality)
const DPI = 72;
const HIGH_RES_DPI = 300; // Add high resolution DPI constant

// Define border width in inches (will be updated dynamically through UI)
const BORDER_WIDTH_INCHES = 0.75;
let BORDER_WIDTH_PIXELS = BORDER_WIDTH_INCHES * DPI;
const DEFAULT_BORDER_COLOR = "#000000"; // Default border color

// Define outer back border (fixed at 1/3 of the border width)
const BACK_BORDER_INCHES = BORDER_WIDTH_INCHES / 3;
let BACK_BORDER_PIXELS = BACK_BORDER_INCHES * DPI;

// Function to update back border based on border width
const updateBackBorderSize = (borderWidthInches) => {
  return borderWidthInches / 3 * DPI;
};

// Configure transformer style to make resizing more visible and disable cropping behavior
setTransformerStyle({
  anchorStroke: '#1a88ff', // Make anchors more visible with blue color
  anchorStrokeWidth: 2,
  borderStroke: '#1a88ff',
  borderStrokeWidth: 2,
  borderDash: [], // Solid line instead of dashed
  // These settings help ensure resizing handles are clearly visible
  rotateAnchorOffset: 25,
  // Enable all 8 resize handles
  enabledAnchors: [
    'top-left',
    'top-center',
    'top-right',
    'middle-right',
    'middle-left',
    'bottom-left',
    'bottom-center',
    'bottom-right'
  ],
  // Make middle handles more visible
  anchorCornerRadius: 5,
  anchorFill: '#ffffff',
  // Ensure all handles are clickable
  anchorSize: 12,
  // Make sure middle handles are properly positioned
  padding: 5
});

// Define canvas sizes in inches and convert to pixels for the INNER area
const CANVAS_SIZES = {
  "8x10": { width: 8 * DPI, height: 10 * DPI },
  "9x9": { width: 9 * DPI, height: 9 * DPI },
  "12x12": { width: 12 * DPI, height: 12 * DPI },
  "10x16": { width: 10 * DPI, height: 16 * DPI },
  "14x14": { width: 14 * DPI, height: 14 * DPI },
  "16x20": { width: 16 * DPI, height: 20 * DPI },
  "18x18": { width: 18 * DPI, height: 18 * DPI },
  "20x20": { width: 20 * DPI, height: 20 * DPI },
};

// Default canvas size
const DEFAULT_SIZE = "8x10";
let currentCanvasSize = DEFAULT_SIZE; // Track the current canvas size globally

// Function to get the total size including border
const getTotalSize = (innerSize) => {
  return {
    width: innerSize.width + 2 * BORDER_WIDTH_PIXELS,
    height: innerSize.height + 2 * BORDER_WIDTH_PIXELS
  };
};

// Function to get the total size including border and back area
const getTotalSizeWithBack = (innerSize) => {
  return {
    width: innerSize.width + 2 * BORDER_WIDTH_PIXELS + 2 * BACK_BORDER_PIXELS,
    height: innerSize.height + 2 * BORDER_WIDTH_PIXELS + 2 * BACK_BORDER_PIXELS
  };
};

// Use total size (inner + border) for the store
const totalDefaultSize = getTotalSizeWithBack(CANVAS_SIZES[DEFAULT_SIZE]);

const store = createStore({
  key: "j9xn_MFGfG0fJpLOeYeD1", // Replace with your Polotno key
  showCredit: true,
  width: totalDefaultSize.width,
  height: totalDefaultSize.height,
});

const page = store.addPage();

// Create overlay elements
const mirrorWrap = page.addElement({
  type: "image",
  width: store.width,
  height: store.height,
  selectable: false,
  alwaysOnTop: true,
  showInExport: false,
  name: "mirrorWrap",
  visible: false,
});

const borderElement = page.addElement({
  type: "image",
  width: store.width,
  height: store.height,
  selectable: false,
  alwaysOnTop: true,
  showInExport: true,
  name: "borderElement",
  visible: false,
});

// Add new blur overlay element
const blurOverlay = page.addElement({
  type: "image",
  width: store.width,
  height: store.height,
  selectable: false,
  alwaysOnTop: true,
  showInExport: false,
  name: "blurOverlay",
  visible: false,
});

// Add new image wrap element following documentation
const imageWrapElement = page.addElement({
  type: 'image',
  src: '', // Will be set dynamically
  width: store.width,
  height: store.height,
  selectable: false,
  alwaysOnTop: true,
  showInExport: false,
  name: 'imageWrap',
  visible: false,
});

// Update PADDING to use the new border width constant
let PADDING = BORDER_WIDTH_PIXELS;

// Disable crop on double-click for images

async function generateMirrorWrap() {
  // First check if borderElement is defined
  if (!borderElement) {
    console.error("borderElement is undefined");
    return;
  }

  // Store the current visibility state of the border and image wrap
  const borderWasVisible = borderElement.visible;
  const imageWrapWasVisible = imageWrapElement.visible;

  // Temporarily hide the border and image wrap for generating mirror wrap
  if (borderWasVisible) {
    borderElement.set({ visible: false });
  }
  if (imageWrapWasVisible) {
    imageWrapElement.set({ visible: false });
  }

  // Convert the current 'store' content into an <img>
  const content = await store.toDataURL();
  const imageContent = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = content;
    img.stretchEnabled = true;
  });

  // Increase the mirror area by reducing the inner content size
  const mirrorPadding = PADDING * 1.5; // Increase padding by 50% to get more mirror area

  // Create a "cropped" inner canvas with increased padding
  const innerContent = document.createElement("canvas");
  innerContent.width = store.width - 2 * mirrorPadding;
  innerContent.height = store.height - 2 * mirrorPadding;
  const innerCtx = innerContent.getContext("2d");

  // Calculate offsets based on the back border
  const backOffset = BACK_BORDER_PIXELS;

  // Draw the full image offset so only the center region appears in innerContent
  innerCtx.drawImage(imageContent, -mirrorPadding, -mirrorPadding);

  // Create final canvas covering the entire area (including the padded mirror regions)
  const canvas = document.createElement("canvas");
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext("2d");

  // 1. Draw the main (non-mirrored) center region
  ctx.drawImage(innerContent, mirrorPadding, mirrorPadding);

  /*
   * Below are the eight mirrored regions around the center.
   * Each region uses ctx.save() / ctx.restore() plus translate/scale
   * to flip the innerContent horizontally/vertically as needed.
   */

  // 2. Top-left corner (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 3. Top-center (mirrored vertically only)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 4. Top-right corner (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 5. Middle-left (mirrored horizontally only)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 6. Middle-right (mirrored horizontally only)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, mirrorPadding);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 7. Bottom-left (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 8. Bottom-center (mirrored vertically only)
  ctx.save();
  ctx.translate(mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 9. Bottom-right (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, -innerContent.width, -innerContent.height);
  ctx.restore();

  // Draw a dashed line for the main inner area
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Create dashed line
  ctx.strokeRect(
    PADDING + backOffset,
    PADDING + backOffset,
    store.width - (PADDING + backOffset) * 2,
    store.height - (PADDING + backOffset) * 2
  );

  // Draw outer "Back" border
  ctx.strokeStyle = 'white';
  ctx.lineWidth = Math.max(1, Math.round(ctx.lineWidth * 0.8)); // Slightly thinner line
  ctx.setLineDash([3, 3]); // Smaller dashed line
  ctx.strokeRect(
    backOffset,
    backOffset,
    store.width - backOffset * 2,
    store.height - backOffset * 2
  );

  // Add "Sides" text labels
  ctx.font = `${Math.max(12, Math.round(DPI / 6))}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top side
  ctx.fillText('Sides', canvas.width / 2, (PADDING + backOffset * 3) / 2);

  // Add "Back" text labels - smaller than "Sides"
  const backFontSize = Math.max(9, Math.round(DPI / 8));
  ctx.font = `${backFontSize}px Arial`;

  // Top back label
  ctx.fillText('Back', canvas.width / 2, backOffset / 2);
  // Left back label
  ctx.save();
  ctx.translate(backOffset / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.restore();
  // Right back label
  ctx.save();
  ctx.translate(canvas.width - backOffset / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.restore();

  // Restore the border and image wrap visibility if they were visible before
  if (borderWasVisible) {
    setTimeout(() => {
      borderElement.set({ visible: true });
    }, 100);
  }

  if (imageWrapWasVisible) {
    setTimeout(() => {
      imageWrapElement.set({ visible: true });
    }, 100);
  }

  return canvas.toDataURL();
}

// Update applyBorder to use the border width as default
const applyBorder = (color, width) => {
  const borderWidth = width || BORDER_WIDTH_PIXELS;
  // Calculate border width in inches and back border size
  const borderWidthInches = borderWidth / DPI;
  const backBorderPixels = updateBackBorderSize(borderWidthInches);

  const canvas = document.createElement("canvas");
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Clear the inner rectangle (leave border)
  ctx.clearRect(
    borderWidth + backBorderPixels,
    borderWidth + backBorderPixels,
    canvas.width - (borderWidth + backBorderPixels) * 2,
    canvas.height - (borderWidth + backBorderPixels) * 2
  );

  const borderDataUrl = canvas.toDataURL();
  borderElement.set({
    src: borderDataUrl,
    width: store.width,
    height: store.height,
    visible: true,
  });
};

// Comment out the old applyImageWrap function
/*
async function applyImageWrap() {
  // ... existing code ...
}
*/

// New simplified image wrap function based on documentation
async function applyImageWrap() {
  // Create a canvas for the wrap effect
  const canvas = document.createElement('canvas');
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext('2d');

  // Draw a dashed white rectangle as the inner wrap (Sides)
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Create dashed line
  ctx.strokeRect(
    PADDING + BACK_BORDER_PIXELS,
    PADDING + BACK_BORDER_PIXELS,
    store.width - (PADDING + BACK_BORDER_PIXELS) * 2,
    store.height - (PADDING + BACK_BORDER_PIXELS) * 2
  );

  // Draw outer "Back" border
  ctx.lineWidth = Math.max(1, Math.round(ctx.lineWidth * 0.8)); // Slightly thinner line
  ctx.setLineDash([3, 3]); // Smaller dashed line
  ctx.strokeRect(
    BACK_BORDER_PIXELS,
    BACK_BORDER_PIXELS,
    store.width - BACK_BORDER_PIXELS * 2,
    store.height - BACK_BORDER_PIXELS * 2
  );

  // Add "Sides" text
  ctx.font = `${Math.max(12, Math.round(DPI / 6))}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Sides', canvas.width / 2, (PADDING + BACK_BORDER_PIXELS * 3) / 2);

  // Add "Back" text labels - smaller than "Sides"
  const backFontSize = Math.max(9, Math.round(DPI / 8));
  ctx.font = `${backFontSize}px Arial`;

  // Top back label
  ctx.fillText('Back', canvas.width / 2, BACK_BORDER_PIXELS / 2);
  // Left back label
  ctx.save();
  ctx.rotate(-Math.PI / 2);
  ctx.restore();
  // Right back label
  ctx.save();
  ctx.rotate(Math.PI / 2);
  ctx.restore();

  // Convert to data URL
  const wrapDataUrl = canvas.toDataURL();

  // Apply to the image wrap element
  imageWrapElement.set({
    src: wrapDataUrl,
    visible: true
  });
}

// Function to apply blur overlay
async function applyBlurOverlay() {
  // Create a canvas for the blur effect
  const canvas = document.createElement('canvas');
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext('2d');

  // Get the current canvas content
  const content = await store.toDataURL();
  const imageContent = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = content;
    img.stretchEnabled = true;
  });

  // Draw the full image
  ctx.drawImage(imageContent, 0, 0);

  // Apply blur to the entire canvas
  ctx.filter = 'blur(7px)';
  ctx.drawImage(imageContent, 0, 0);
  ctx.filter = 'none';

  // Add text with DPI-adjusted font size for Sides
  ctx.font = `${Math.max(12, Math.round(DPI / 6))}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Side", canvas.width / 2, canvas.height / 2);

  // Add "Back" text labels - smaller font
  const backFontSize = Math.max(9, Math.round(DPI / 8));
  ctx.font = `${backFontSize}px Arial`;

  // Back text labels
  ctx.fillText('Back', canvas.width / 2, BACK_BORDER_PIXELS / 2); // top

  // Left back label
  ctx.save();
  ctx.translate(BACK_BORDER_PIXELS / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.restore();

  // Right back label
  ctx.save();
  ctx.translate(canvas.width - BACK_BORDER_PIXELS / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.restore();

  // Clear the center rectangle (non-blurred area)
  ctx.clearRect(
    PADDING + BACK_BORDER_PIXELS,
    PADDING + BACK_BORDER_PIXELS,
    store.width - (PADDING + BACK_BORDER_PIXELS) * 2,
    store.height - (PADDING + BACK_BORDER_PIXELS) * 2
  );

  // Convert to data URL
  const blurDataUrl = canvas.toDataURL();

  // Apply to the blur overlay element
  blurOverlay.set({
    src: blurDataUrl,
    visible: true
  });
}

// Function to resize canvas and scale all elements proportionally
const resizeCanvas = (newSizeKey, currentBorderColor, currentBorderWidth) => {
  console.log(`Resizing canvas to: ${newSizeKey}`);
  const innerSize = CANVAS_SIZES[newSizeKey];

  if (!innerSize) {
    console.error(`Size "${newSizeKey}" not found in CANVAS_SIZES`);
    return;
  }

  const borderColorToUse = currentBorderColor || DEFAULT_BORDER_COLOR;
  const borderWidthToUse = currentBorderWidth || BORDER_WIDTH_PIXELS;

  // Calculate total size including borders and back area
  const totalSize = getTotalSizeWithBack(innerSize);

  const oldWidth = store.width;
  const oldHeight = store.height;
  const scaleX = totalSize.width / oldWidth;
  const scaleY = totalSize.height / oldHeight;

  // Update store dimensions to total size
  store.setSize(totalSize.width, totalSize.height);

  // Scale and update overlay elements
  borderElement.set({
    width: totalSize.width,
    height: totalSize.height,
  });

  mirrorWrap.set({
    width: totalSize.width,
    height: totalSize.height,
  });

  imageWrapElement.set({
    width: totalSize.width,
    height: totalSize.height,
  });

  blurOverlay.set({
    width: totalSize.width,
    height: totalSize.height,
  });

  // Scale all other elements
  page.children.forEach((element) => {
    if (
      element !== borderElement &&
      element !== mirrorWrap &&
      element !== imageWrapElement &&
      element !== blurOverlay
    ) {
      element.set({
        x: element.x * scaleX,
        y: element.y * scaleY,
        width: element.width * scaleX,
        height: element.height * scaleY,
      });
    }
  });

  // After resizing, update any visible effects
  if (mirrorWrap.visible) {
    setTimeout(() => generateMirrorWrap().then(url => mirrorWrap.set({ src: url })), 100);
  }

  if (borderElement.visible) {
    setTimeout(() => applyBorder(borderColorToUse, borderWidthToUse), 100);
  }

  if (imageWrapElement.visible) {
    setTimeout(() => applyImageWrap(), 100);
  }
};

// Add default background image
page.addElement({
  type: "image",
  width: store.width,
  height: store.height,
  src: "https://images.unsplash.com/photo-1742302954292-1f903368084e?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
});

let timeout;
let skipChange = false;

const requestUpdateWrap = () => {
  if (timeout || skipChange) {
    return;
  }
  timeout = setTimeout(() => {
    timeout = null;
    generateMirrorWrap().then((url) => {
      skipChange = true;
      mirrorWrap.set({
        src: url,
        visible: mirrorWrap.visible,
      });
      skipChange = false;
    });
  }, 300);
};

// New function to update image wrap and blur overlay
const requestUpdateImageWrap = () => {
  if (timeout || skipChange) {
    return;
  }
  timeout = setTimeout(() => {
    timeout = null;
    applyImageWrap();
    applyBlurOverlay();
  }, 300);
};

// Handle store changes
store.on("change", () => {
  if (skipChange) {
    return;
  }

  // Update effects if visible
  if (mirrorWrap.visible) {
    requestUpdateWrap();
  }

  if (imageWrapElement.visible) {
    requestUpdateImageWrap();
  }
});

async function generateMirrorWrapForDownload() {
  // First check if borderElement is defined
  if (!borderElement) {
    console.error("borderElement is undefined");
    return;
  }

  // Convert the current 'store' content into an <img>
  const content = await store.toDataURL();
  const imageContent = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = content;
    img.stretchEnabled = true;
  });

  // Increase the mirror area by reducing the inner content size
  const mirrorPadding = PADDING * 1.5; // Increase padding by 50% to get more mirror area

  // Create a "cropped" inner canvas with increased padding
  const innerContent = document.createElement("canvas");
  innerContent.width = store.width - 2 * mirrorPadding;
  innerContent.height = store.height - 2 * mirrorPadding;
  const innerCtx = innerContent.getContext("2d");

  // Draw the full image offset so only the center region appears in innerContent
  innerCtx.drawImage(imageContent, -mirrorPadding, -mirrorPadding);

  // Create final canvas covering the entire area (including the padded mirror regions)
  const canvas = document.createElement("canvas");
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext("2d");

  // 1. Draw the main (non-mirrored) center region
  ctx.drawImage(innerContent, mirrorPadding, mirrorPadding);

  // 2. Top-left corner (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 3. Top-center (mirrored vertically only)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 4. Top-right corner (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 5. Middle-left (mirrored horizontally only)
  ctx.save();
  ctx.translate(mirrorPadding, mirrorPadding);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 6. Middle-right (mirrored horizontally only)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, mirrorPadding);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 7. Bottom-left (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 8. Bottom-center (mirrored vertically only)
  ctx.save();
  ctx.translate(mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 9. Bottom-right (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(canvas.width - mirrorPadding, canvas.height - mirrorPadding);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, -innerContent.width, -innerContent.height);
  ctx.restore();

  return canvas.toDataURL();
}

const downloadHighResImage = async (currentCanvasSize) => {
  try {
    // Get current canvas size info
    const currentSize = Object.entries(CANVAS_SIZES).find(
      ([key]) => key === currentCanvasSize
    )[1];

    // Calculate scale factor between current DPI and high-res DPI
    const scaleFactor = HIGH_RES_DPI / DPI;

    // Calculate dimensions including borders
    const totalWidth = currentSize.width + 2 * BORDER_WIDTH_PIXELS + 2 * BACK_BORDER_PIXELS;
    const totalHeight = currentSize.height + 2 * BORDER_WIDTH_PIXELS + 2 * BACK_BORDER_PIXELS;

    // Create high-res canvas with full dimensions (including borders and back)
    const highResCanvas = document.createElement("canvas");
    highResCanvas.width = totalWidth * scaleFactor;
    highResCanvas.height = totalHeight * scaleFactor;
    const highResCtx = highResCanvas.getContext("2d");

    // Scale everything for high-res output
    highResCtx.scale(scaleFactor, scaleFactor);

    // Based on the selected effect, generate the appropriate content
    if (mirrorWrap.visible) {
      // Generate mirror wrap effect at high resolution without guide lines
      const mirrorContent = await generateMirrorWrapForDownload();
      const mirrorImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load mirror image'));
        img.src = mirrorContent;
      });
      highResCtx.drawImage(mirrorImage, 0, 0, totalWidth, totalHeight);
    } else if (borderElement.visible) {
      // Get current canvas content first
      const content = await store.toDataURL();
      const mainImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = content;
      });

      // Draw the main image
      highResCtx.drawImage(mainImage, 0, 0, totalWidth, totalHeight);

      // Extract border color
      let borderColor = DEFAULT_BORDER_COLOR;
      try {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 10;
        tempCanvas.height = 10;
        const tempCtx = tempCanvas.getContext("2d");

        const borderImg = await new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = borderElement.src;
        });

        tempCtx.drawImage(borderImg, 0, 0, 10, 10);
        const pixelData = tempCtx.getImageData(0, 0, 1, 1).data;
        borderColor = `rgb(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]})`;
      } catch (error) {
        console.error("Error extracting border color:", error);
      }

      // Apply border
      highResCtx.fillStyle = borderColor;
      highResCtx.fillRect(0, 0, totalWidth, totalHeight);

      // Clear the inner rectangle
      highResCtx.clearRect(
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        totalWidth - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS),
        totalHeight - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS)
      );
    } else if (imageWrapElement.visible) {
      // Get current canvas content first
      const content = await store.toDataURL();
      const mainImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = content;
      });

      // Draw the main image
      highResCtx.drawImage(mainImage, 0, 0, totalWidth, totalHeight);

      // Apply blur to the border areas
      highResCtx.save();
      highResCtx.filter = 'blur(7px)';
      
      // Draw blurred image in the border areas
      highResCtx.drawImage(mainImage, 0, 0, totalWidth, totalHeight);
      
      // Clear the center area
      highResCtx.restore();
      highResCtx.clearRect(
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        totalWidth - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS),
        totalHeight - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS)
      );

      // Draw the unblurred center image
      highResCtx.drawImage(
        mainImage,
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        totalWidth - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS),
        totalHeight - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS),
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS,
        totalWidth - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS),
        totalHeight - 2 * (BORDER_WIDTH_PIXELS + BACK_BORDER_PIXELS)
      );
    } else {
      // No effect selected, just draw the main image
      const content = await store.toDataURL();
      const mainImage = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = content;
      });
      highResCtx.drawImage(mainImage, 0, 0, totalWidth, totalHeight);
    }

    // Create download link
    const link = document.createElement("a");
    link.download = `canvas-image-300dpi.png`;
    link.href = highResCanvas.toDataURL("image/png");
    link.click();
  } catch (error) {
    console.error("Error generating high-res image:", error);
  }
};

const CustomToolbar = ({ store }) => {
  // Use the global constants for initial state
  const [borderColor, setBorderColor] = useState(DEFAULT_BORDER_COLOR);
  const [borderWidth, setBorderWidth] = useState(BORDER_WIDTH_PIXELS);
  const [borderWidthInches, setBorderWidthInches] = useState(BORDER_WIDTH_INCHES);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedOption, setSelectedOption] = useState("none");
  const [canvasSize, setCanvasSize] = useState(DEFAULT_SIZE);
  const [isUploading, setIsUploading] = useState(false);

  store.on("change", () => {
    store.find((item) => {
      if (item.type === "image") {

        // Skip overlay elements
        if (item === borderElement || item === mirrorWrap || item === imageWrapElement || item === blurOverlay) {
          return;
        }

        // Get current border dimensions
        const borderWidth = BORDER_WIDTH_PIXELS;
        const backBorderWidth = BACK_BORDER_PIXELS;
        const totalBorderWidth = borderWidth + backBorderWidth;
        // // Different behavior based on selected effect
        if (forCanvasSelectedOption === "mirror" || forCanvasSelectedOption === "border") {
          item.set({
            stretchEnabled: true,
            draggable: true
          });

          // For mirror wrap: Allow resizing from border outward and ensure image covers the entire canvas
          if (item.x > totalBorderWidth) {
            item.set({ x: totalBorderWidth - Math.random() });
          }
          if (item.y > totalBorderWidth) {
            item.set({ y: totalBorderWidth - Math.random() });
          }

          // Ensure minimum width and height cover the inner canvas
          const minWidth = item.page.computedWidth - totalBorderWidth - item.x;  
          const minHeight = item.page.computedHeight - totalBorderWidth - item.x;

          // Allow image to extend beyond minimum size when dragging, considering total border width
          if (item.width < minWidth || item.x + item.width < item.page.computedWidth - totalBorderWidth) {
            item.set({ width: Math.max(minWidth, item.page.computedWidth - item.x - totalBorderWidth) });
          }
          if (item.height < minHeight || item.y + item.height < item.page.computedHeight - totalBorderWidth) {
            item.set({ height: Math.max(minHeight, item.page.computedHeight - item.y - totalBorderWidth) });
          }
          
        } else if (forCanvasSelectedOption === "imageWrap") {
          item.set({
            stretchEnabled: true,
          });
          if (item.x > 0) {
            item.set({
              x: -Math.random(),
            });
          }
          if (item.y > 0) {
            item.set({
              y: -Math.random(),
            });
          }
          if (item.width < item.page.computedWidth - item.x) {
            item.set({
              width: item.page.computedWidth - item.x,
            });
          }
          if (item.height < item.page.computedHeight - item.y) {
            item.set({
              height: item.page.computedHeight - item.y,
            });
          }
        }
      }
    });
  });
  // Update global currentCanvasSize whenever local state changes
  useEffect(() => {
    currentCanvasSize = canvasSize;
  }, [canvasSize]);

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      // Create a temporary image to get dimensions
      const tempImg = new Image();
      tempImg.onload = () => {
        // Find all image elements that are not overlays
        const imageElements = page.children.filter(
          el => el.type === 'image' &&
            el !== borderElement &&
            el !== mirrorWrap &&
            el !== imageWrapElement &&
            el !== blurOverlay
        );
        tempImg.stretchEnabled = true;

        // Make image fill the entire page area including borders
        // We'll position it at 0,0 and use the entire store dimensions
        if (imageElements.length > 0) {
          // Replace the first image element with the uploaded image
          const mainImage = imageElements[0];

          // Set position to top left corner of the page
          mainImage.set({
            x: 0,
            y: 0,
            width: store.width,
            height: store.height,
            opacity: 1
          });

          // Then set the source and stretch mode
          mainImage.set({
            src: event.target.result,
            // Force full stretching with no concern for distortion
            stretchMode: 'fill',
            objectFit: 'fill',
            disableAutoResize: true,
            crop: null,
            cropEnabled: false,
            // Allow for completely free manual stretching
            selectable: true,
            draggable: true,
            transformEnabled: true,
            keepRatio: false,
            // Ensure all handles are visible and functional
            transformerConfig: {
              enabledAnchors: [
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'middle-left',
                'bottom-left',
                'bottom-center',
                'bottom-right'
              ],
              rotateEnabled: false, // Disable rotation to focus on stretching
              // Disable any cropping behavior
              cropEnabled: false,
              // Allow free transformation
              boundBoxFunc: (oldBox, newBox) => newBox,
              // Ensure handles are always visible
              anchorSize: 12,
              anchorStroke: '#1a88ff',
              anchorFill: '#ffffff',
              anchorCornerRadius: 5
            }
          });

          // Select the image so user can see resize handles
          store.selectElements([mainImage]);
        } else {
          // If no image element found, create a new one
          const newImage = page.addElement({
            type: "image",
            src: event.target.result,
            x: 0,
            y: 0,
            width: store.width,
            height: store.height,
            opacity: 1,
            // Force full stretching with no concern for distortion
            stretchMode: 'fill',
            objectFit: 'fill',
            disableAutoResize: true,
            crop: null,
            cropEnabled: false,
            // Allow for completely free manual stretching
            selectable: true,
            draggable: true,
            transformEnabled: true,
            keepRatio: false,
            // Ensure all handles are visible and functional
            transformerConfig: {
              enabledAnchors: [
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'middle-left',
                'bottom-left',
                'bottom-center',
                'bottom-right'
              ],
              rotateEnabled: false, // Disable rotation to focus on stretching
              // Disable any cropping behavior
              cropEnabled: false,
              // Allow free transformation
              boundBoxFunc: (oldBox, newBox) => newBox,
              // Ensure handles are always visible
              anchorSize: 12,
              anchorStroke: '#1a88ff',
              anchorFill: '#ffffff',
              anchorCornerRadius: 5
            }
          });

          // If needed, move the element to the bottom of the stack using proper API
          // instead of setting zIndex directly
          if (page.children.length > 1) {
            page.moveBottom(newImage);
          }

          // Select the new image
          store.selectElements([newImage]);
        }

        // Update effects if active
        if (mirrorWrap.visible) {
          setTimeout(() => {
            generateMirrorWrap().then((url) => {
              mirrorWrap.set({ src: url });
            });
          }, 300);
        }

        if (imageWrapElement.visible) {
          setTimeout(() => {
            applyImageWrap();
            applyBlurOverlay();
          }, 300);
        }

        setIsUploading(false);
      };
      tempImg.src = event.target.result;
    };

    reader.readAsDataURL(file);
  };

  const handleOptionChange = (e) => {
    const newOption = e.target.value;
    setSelectedOption(newOption);
    forCanvasSelectedOption = newOption;

    skipChange = true; // Prevent store.on("change") from interfering
    mirrorWrap.set({ visible: false });
    borderElement.set({ visible: false });
    imageWrapElement.set({ visible: false });
    blurOverlay.set({ visible: false });

    if (newOption === "mirror") {
      generateMirrorWrap().then((url) => {
        mirrorWrap.set({
          src: url,
          visible: true,
        });
        skipChange = false;
      });
    } else if (newOption === "border") {
      applyBorder(borderColor, borderWidth);
      skipChange = false;
    } else if (newOption === "imageWrap") {
      // Apply initial effects
      applyImageWrap();
      applyBlurOverlay();
      skipChange = false;
    } else {
      skipChange = false;
    }
  };

  const handleColorChange = (color) => {
    setBorderColor(color.hex);
    if (selectedOption === "border") {
      skipChange = true;
      applyBorder(color.hex, borderWidth);
      skipChange = false;
    }
  };

  const handleWidthChange = (value) => {
    const width = Math.max(1, Math.min(200, value));
    setBorderWidth(width);

    // Update border width in inches
    const newBorderWidthInches = width / DPI;
    setBorderWidthInches(newBorderWidthInches);

    if (selectedOption === "border") {
      skipChange = true;
      applyBorder(borderColor, width);
      skipChange = false;
    }
  };

  const handleBorderWidthInchesChange = (e) => {
    const widthInches = parseFloat(e.target.value);
    setBorderWidthInches(widthInches);
    const widthPixels = widthInches * DPI;
    setBorderWidth(widthPixels);

    // Update global variables that affect all effects
    BORDER_WIDTH_PIXELS = widthPixels;
    PADDING = widthPixels;
    BACK_BORDER_PIXELS = updateBackBorderSize(widthInches);

    // Update back border size based on the new border width
    const backBorderPixels = BACK_BORDER_PIXELS;

    skipChange = true;

    // Apply changes based on current selected option
    if (selectedOption === "border") {
      // Redraw the border with new dimensions
      const canvas = document.createElement("canvas");
      canvas.width = store.width;
      canvas.height = store.height;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = borderColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.clearRect(
        widthPixels + backBorderPixels,
        widthPixels + backBorderPixels,
        canvas.width - (widthPixels + backBorderPixels) * 2,
        canvas.height - (widthPixels + backBorderPixels) * 2
      );

      const borderDataUrl = canvas.toDataURL();
      borderElement.set({
        src: borderDataUrl,
        width: store.width,
        height: store.height,
        visible: true,
      });
    } else if (selectedOption === "mirror") {
      // Regenerate mirror wrap with new border width
      generateMirrorWrap().then((url) => {
        mirrorWrap.set({
          src: url,
          visible: true,
        });
      });
    } else if (selectedOption === "imageWrap") {
      // Regenerate image wrap with new border width
      applyImageWrap();
      applyBlurOverlay();
    }

    skipChange = false;
  };

  const handleSizeChange = (e) => {
    const newSize = e.target.value;
    console.log("Selected size:", newSize);
    setCanvasSize(newSize);

    skipChange = true;
    resizeCanvas(newSize, borderColor, borderWidth);

    // Use a small timeout to ensure all canvas operations complete
    setTimeout(() => {
      skipChange = false;

      // Regenerate effects if they're active
      if (selectedOption === "mirror" && mirrorWrap.visible) {
        generateMirrorWrap().then((url) => {
          mirrorWrap.set({ src: url, visible: true });
        });
      } else if (selectedOption === "border" && borderElement.visible) {
        applyBorder(borderColor, borderWidth);
      } else if (selectedOption === "imageWrap" && imageWrapElement.visible) {
        applyImageWrap();
      }
    }, 300);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        backgroundColor: "#f5f5f5",
        borderBottom: "1px solid #ddd",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}
      >
        <Toolbar store={store} downloadButtonEnabled />
        <Button
          icon="download"
          intent="primary"
          text="Download 300 DPI"
          onClick={() => downloadHighResImage(currentCanvasSize)}
          style={{ marginLeft: "10px" }}
        />
        <div style={{ marginLeft: "10px", position: "relative" }}>
          <Button
            icon="upload"
            intent="success"
            text={isUploading ? "Uploading..." : "Upload Image"}
            onClick={() => document.getElementById("image-upload").click()}
            disabled={isUploading}
          />
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        <RadioGroup
          inline
          onChange={handleOptionChange}
          selectedValue={selectedOption}
          label="Select Effect:"
        >
          <Radio label="None" value="none" />
          <Radio label="Mirror Wrap" value="mirror" />
          <Radio label="Solid Border" value="border" />
          <Radio label="Image Wrap" value="imageWrap" />
        </RadioGroup>

        <div
          style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}
        >
          <RadioGroup
            inline
            onChange={handleSizeChange}
            selectedValue={canvasSize}
            label="Canvas Size (inches):"
          >
            <Radio label="8 × 10" value="8x10" />
            <Radio label="9 × 9" value="9x9" />
            <Radio label="12 × 12" value="12x12" />
            <Radio label="14 × 14" value="14x14" />
            <Radio label="16 × 20" value="16x20" />
            <Radio label="18 × 18" value="18x18" />
            <Radio label="20 × 20" value="20x20" />
          </RadioGroup>
        </div>

        {selectedOption !== "none" && (
          <div
            style={{
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              marginTop: "10px",
              width: "100%"
            }}
          >
            {selectedOption === "border" && (
              <Popover
                isOpen={showColorPicker}
                onInteraction={(state) => setShowColorPicker(state)}
                content={
                  <div style={{ padding: "10px" }}>
                    <SketchPicker
                      color={borderColor}
                      onChange={handleColorChange}
                    />
                  </div>
                }
                position="bottom"
              >
                <Button
                  style={{
                    backgroundColor: borderColor,
                    width: "30px",
                    height: "30px",
                    marginRight: "10px",
                  }}
                />
              </Popover>
            )}

            <RadioGroup
              inline
              onChange={handleBorderWidthInchesChange}
              selectedValue={borderWidthInches}
              label="Border Width (inches):"
            >
              <Radio label="0.75″" value={0.75} />
              <Radio label="1.25″" value={1.25} />
              <Radio label="1.50″" value={1.5} />
            </RadioGroup>
          </div>
        )}
      </div>
    </div>
  );
};

// Generate initial mirror wrap
generateMirrorWrap().then((url) => {
  mirrorWrap.set({ src: url, visible: false });
});

export const App = ({ store }) => {
  return (
    <PolotnoContainer style={{ width: "100vw", height: "100vh" }}>
      <SidePanelWrap>
        {/* <SidePanel store={store} /> */}
      </SidePanelWrap>
      <WorkspaceWrap>
        <CustomToolbar store={store} />
        <Workspace
          store={store}
          components={{
            ContextMenu: () => null, // Disable right-click context menu
            PageControls: () => null, // Disable page controls
          }}
          altCloneEnabled={false} // Disable alt+drag to clone
          disableAddLayer={false} // Enable add layer feature to allow transformations
          disablePageControls={true} // Disable page controls
          disableCrop={true} // Disable crop functionality entirely
          imageCropEnabled={false} // Disable crop mode for images
          backgroundCropEnabled={false} // Disable crop for background images too
          onDoubleClick={(e, store) => {
            const { selectedElements } = store;
            if (selectedElements.length === 1 && selectedElements[0].type === 'image') {
              const image = selectedElements[0];
              // Enable transformation mode
              image.set({
                transformEnabled: true,
                selectable: true,
                draggable: true,
                transformerConfig: {
                  enabledAnchors: [
                    'top-left',
                    'top-center',
                    'top-right',
                    'middle-right',
                    'middle-left',
                    'bottom-left',
                    'bottom-center',
                    'bottom-right'
                  ],
                  rotateEnabled: false,
                  cropEnabled: false,
                  boundBoxFunc: (oldBox, newBox) => newBox,
                  anchorSize: 12,
                  anchorStroke: '#1a88ff',
                  anchorFill: '#ffffff',
                  anchorCornerRadius: 5
                }
              });
              // Keep the image selected
              store.selectElements([image]);
              return false; // Prevent default double-click behavior
            }
            return true; // Allow default for non-selected areas
          }}
        />
        <ZoomButtons store={store} />
      </WorkspaceWrap>
    </PolotnoContainer>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App store={store} />);
