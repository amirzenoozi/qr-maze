# Prompt for Claude: 3D Interactive QR Code Maze

**Role:** Act as an expert frontend developer and 3D graphics specialist, proficient in React, TypeScript, `@react-three/fiber` (R3F), and `@react-three/drei`.

## Project Overview
I want to build a 3D interactive maze based on a QR code matrix. The core idea is that the black modules of the QR code act as 3D walls, and the white modules are the playable paths. The user navigates a glowing sphere through this maze. Once the maze is solved (or via a toggle), the camera shifts to a top-down view, allowing the user to scan the QR code with their physical smartphone.

## Tech Stack
- React
- TypeScript
- `@react-three/fiber`
- `@react-three/drei` (for camera controls, materials, and helpers)
- `qrcode` (npm package for generating the base 2D array)

## Key Features & Requirements

### 1. QR Code Matrix Generation & Maze Adaptation
- Generate a QR Code for a given URL (e.g., "https://example.com") using the highest error correction level (**Level H** - 30%).
- Extract the 2D boolean array (1 = black/wall, 0 = white/path).
- **The Challenge:** A standard QR code is disjointed and has closed loops. 
- **The Solution:** Implement a maze-carving algorithm (like DFS) that slightly modifies the matrix to ensure a valid continuous path from the start point (e.g., near the top-left finder pattern) to the end point (bottom-right finder pattern). 
- *Crucial constraint:* Do not modify the three large finder patterns in the corners. Keep the structural modifications under the 30% threshold so the QR code remains scannable.

### 2. 3D Scene Rendering (R3F)
- **Walls:** Map the 1s from the matrix to 3D `BoxGeometry` meshes. Apply a dark, modern material (e.g., dark concrete or frosted glass).
- **Floor:** A flat plane beneath the maze.
- **Lighting:** Use ambient lighting combined with dynamic point lights.

### 3. Player Character & Controls
- The player is a glowing sphere.
- Attach a `PointLight` to the player sphere so it casts dynamic, real-time shadows on the maze walls as it moves.
- Implement basic keyboard controls (WASD or Arrow keys) to move the sphere through the 0s (paths) of the matrix. Implement basic collision detection so the sphere cannot pass through walls.

### 4. Camera & View Modes
- **Gameplay Mode:** An isometric or slightly angled third-person camera that follows the player sphere.
- **Scan Mode (Top-Down):** A button or a victory event that smoothly transitions the camera (using `@react-three/drei`'s `CameraControls` or similar) to a direct 90-degree top-down Orthographic view. In this mode, the shadows should flatten or disappear so the visual output on the screen perfectly resembles a high-contrast 2D QR code ready for scanning.

## Boilerplate Code Request
Please generate the boilerplate code for this project, organized into modular components. I need:
1.  **The QR/Maze Logic (Utility function):** Code to generate the QR matrix and a mock/basic implementation of the path-carving algorithm.
2.  **The Game Context / Store:** State management for player position, maze matrix, and camera mode (Gameplay vs. Scan).
3.  **The 3D Canvas (R3F):** The main Three.js scene setup.
4.  **The Maze Component:** Rendering the walls based on the matrix.
5.  **The Player Component:** The glowing sphere with movement logic and lighting.

**Code Guidelines:**
- Strictly use TypeScript with proper interfaces and types.
- Ensure all comments within the code are written in English.
- Use modern React functional components and hooks.
