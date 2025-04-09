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

// Define DPI constant (300 is standard print quality)
const DPI = 300;

// Define border width in inches
const BORDER_WIDTH_INCHES = 0.75;
const BORDER_WIDTH_PIXELS = BORDER_WIDTH_INCHES * DPI;

// Define canvas sizes in inches and convert to pixels for the INNER area
const CANVAS_SIZES = {
  "8x10":  { width: 8  * DPI, height: 10 * DPI },
  "9x9":   { width: 9  * DPI, height: 9  * DPI },
  "12x12": { width: 12 * DPI, height: 12 * DPI },
  "10x16": { width: 10 * DPI, height: 16 * DPI },
  "14x14": { width: 14 * DPI, height: 14 * DPI },
  "16x20": { width: 16 * DPI, height: 20 * DPI },
  "18x18": { width: 18 * DPI, height: 18 * DPI },
  "20x20": { width: 20 * DPI, height: 20 * DPI },
};

// Default canvas size
const DEFAULT_SIZE = "8x10";

// Function to get the total size including border
const getTotalSize = (innerSize) => {
  return {
    width: innerSize.width + 2 * BORDER_WIDTH_PIXELS,
    height: innerSize.height + 2 * BORDER_WIDTH_PIXELS
  };
};

// Use total size (inner + border) for the store
const totalDefaultSize = getTotalSize(CANVAS_SIZES[DEFAULT_SIZE]);

const store = createStore({
  key: "nFA5H9elEytDyPyvKL7T", // Replace with your Polotno key
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
const PADDING = BORDER_WIDTH_PIXELS;

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
  });

  // Create a "cropped" inner canvas of size (width - 2*PADDING) x (height - 2*PADDING)
  const innerContent = document.createElement("canvas");
  innerContent.width = store.width - 2 * PADDING;
  innerContent.height = store.height - 2 * PADDING;
  const innerCtx = innerContent.getContext("2d");
  // Draw the full image offset so only the center region appears in innerContent
  innerCtx.drawImage(imageContent, -PADDING, -PADDING);

  // Create final canvas covering the entire area (including the padded mirror regions)
  const canvas = document.createElement("canvas");
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext("2d");

  // 1. Draw the main (non-mirrored) center region
  ctx.drawImage(innerContent, PADDING, PADDING);

  /*
   * Below are the eight mirrored regions around the center.
   * Each region uses ctx.save() / ctx.restore() plus translate/scale
   * to flip the innerContent horizontally/vertically as needed.
   */

  // 2. Top-left corner (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(PADDING, PADDING);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 3. Top-center (mirrored vertically only)
  ctx.save();
  ctx.translate(PADDING, PADDING);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 4. Top-right corner (mirrored horizontally & vertically)
  ctx.save();
  // Move to the right edge so the rightmost corner lines up
  ctx.translate(canvas.width - PADDING, PADDING);
  // Flip horizontally (-1) and vertically (-1)
  ctx.scale(-1, -1);
  // Shift drawing by -innerContent.width so the mirror is flush on the right
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 5. Middle-left (mirrored horizontally only)
  ctx.save();
  ctx.translate(PADDING, PADDING);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, 0, 0);
  ctx.restore();

  // 6. Middle-right (mirrored horizontally only)
  ctx.save();
  ctx.translate(canvas.width - PADDING, PADDING);
  ctx.scale(-1, 1);
  ctx.drawImage(innerContent, -innerContent.width, 0);
  ctx.restore();

  // 7. Bottom-left (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(PADDING, canvas.height - PADDING);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 8. Bottom-center (mirrored vertically only)
  ctx.save();
  ctx.translate(PADDING, canvas.height - PADDING);
  ctx.scale(1, -1);
  ctx.drawImage(innerContent, 0, -innerContent.height);
  ctx.restore();

  // 9. Bottom-right (mirrored horizontally & vertically)
  ctx.save();
  ctx.translate(canvas.width - PADDING, canvas.height - PADDING);
  ctx.scale(-1, -1);
  ctx.drawImage(innerContent, -innerContent.width, -innerContent.height);
  ctx.restore();

  // Optional: visualize the "inner" area with a rectangle (comment out if not needed)
  ctx.rect(PADDING, PADDING, innerContent.width, innerContent.height);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Create dashed line
  ctx.strokeRect(
    PADDING,
    PADDING,
    store.width - PADDING * 2,
    store.height - PADDING * 2
  );

  // Add "Sides" text labels
  ctx.font = `${Math.max(12, Math.round(DPI / 6))}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top side
  ctx.fillText('Sides', canvas.width / 2, PADDING / 2);
  // Bottom side
 
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
  const canvas = document.createElement("canvas");
  canvas.width = store.width;
  canvas.height = store.height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(
    borderWidth,
    borderWidth,
    canvas.width - borderWidth * 2,
    canvas.height - borderWidth * 2
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

  // Draw a dashed red rectangle as the wrap
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Create dashed line
  ctx.strokeRect(
    PADDING,
    PADDING,
    store.width - PADDING * 2,
    store.height - PADDING * 2
  );

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
  });

  // Draw the full image
  ctx.drawImage(imageContent, 0, 0);

  // Apply blur to the entire canvas
  ctx.filter = 'blur(7px)';
  ctx.drawImage(imageContent, 0, 0);
  ctx.filter = 'none';
  
  // Add text with DPI-adjusted font size
  ctx.font = `${Math.max(12, Math.round(DPI / 6))}px Arial`;
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText("Side", canvas.width / 2, canvas.height / 2);

  // Clear the center rectangle (non-blurred area)
  ctx.clearRect(
    PADDING,
    PADDING,
    store.width - PADDING * 2,
    store.height - PADDING * 2
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
const resizeCanvas = (newSizeKey) => {
  console.log(`Resizing canvas to: ${newSizeKey}`);
  const innerSize = CANVAS_SIZES[newSizeKey];
  
  if (!innerSize) {
    console.error(`Size "${newSizeKey}" not found in CANVAS_SIZES`);
    return;
  }

  // Calculate total size including borders
  const totalSize = getTotalSize(innerSize);

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
    setTimeout(() => applyBorder(borderColor, borderWidth), 100);
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
  src: "https://images.unsplash.com/photo-1702234728311-baaa6c8aa212?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTY5OTZ8MHwxfGFsbHw0MHx8fHx8fDJ8fDE3MDI4MjUyODB8&ixlib=rb-4.0.3&q=80&w=1080",
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

const CustomToolbar = ({ store }) => {
  const [borderColor, setBorderColor] = useState("#000000");
  const [borderWidth, setBorderWidth] = useState(BORDER_WIDTH_PIXELS); // Default to our 0.75 inch border
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedOption, setSelectedOption] = useState("none");
  const [canvasSize, setCanvasSize] = useState("");

  const handleOptionChange = (e) => {
    const newOption = e.target.value;
    setSelectedOption(newOption);

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
    if (selectedOption === "border") {
      skipChange = true;
      applyBorder(borderColor, width);
      skipChange = false;
    }
  };

  const handleSizeChange = (e) => {
    const newSize = e.target.value;
    console.log("Selected size:", newSize); 
    setCanvasSize(newSize);

    skipChange = true;
    resizeCanvas(newSize);

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
        
      </div>
      <div style={{ display: "flex", alignItems: "center" }}>
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
        {selectedOption === "border" && (
          <div
            style={{
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
            }}
          >
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
            <span style={{ marginRight: "5px" }}>Width:</span>
            <NumericInput
              min={1}
              max={100}
              value={borderWidth}
              onValueChange={handleWidthChange}
              style={{ width: "60px" }}
            />
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
          disableAddLayer={true} // Disable add layer feature
          disablePageControls={true} // Disable page controls
        />
        <ZoomButtons store={store} />
      </WorkspaceWrap>
    </PolotnoContainer>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App store={store} />);
