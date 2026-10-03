// src/components/App.tsx
"use client";
import React, { useRef, useEffect, useState, useCallback } from "react";
import { Box, Button, ButtonGroup, Center, HStack, IconButton, Progress, Stack, Text, useBreakpointValue, VisuallyHidden } from "@chakra-ui/react";
import { FiArrowDown, FiArrowLeft, FiArrowRight, FiArrowUp, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { detectDevice } from "@/lib/galaxy/quality";
import { tierIndex } from "@/lib/galaxy/tiers";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// NEW: Look Speed variable at the top
const lookSpeed = 0.4; // Adjustable look speed

// Hook to detect portrait orientation
function useIsPortrait() {
    const [isPortrait, setIsPortrait] = useState(
        typeof window !== "undefined" ? window.matchMedia("(orientation: portrait)").matches : false
    );
    useEffect(() => {
        const m = window.matchMedia("(orientation: portrait)");
        const fn = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
        m.addEventListener("change", fn);
        return () => m.removeEventListener("change", fn);
    }, []);
    return isPortrait;
}

// Function to generate flat plane heights (simplified from generateHills)
function generateFlatPlaneHeights(width: number, depth: number, segments: number): number[][] {
    const heights: number[][] = [];
    for (let i = 0; i <= segments; i++) {
        heights[i] = [];
        for (let j = 0; j <= segments; j++) {
            heights[i][j] = 0; // Always flat at height 0
        }
    }
    return heights;
}

export default function App() {
    // Refs for Three.js and Cannon.js objects
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const worldRef = useRef<CANNON.World | null>(null);
    const playerBodyRef = useRef<CANNON.Body | null>(null);
    const gltfModelRef = useRef<THREE.Object3D | null>(null);

    // NEW: Refs for collision visualization
    const playerVisualMeshRef = useRef<THREE.Mesh | null>(null);
    const dynamicCollisionObjectsRef = useRef<{ body: CANNON.Body, mesh: THREE.Mesh }[]>([]); // For house model colliders
    const staticCollisionObjectsRef = useRef<{ body: CANNON.Body, mesh: THREE.Mesh }[]>([]); // For walls, ground, gate posts

    const groundMeshRef = useRef<THREE.Mesh | null>(null);
    const groundBodyRef = useRef<CANNON.Body | null>(null);

    // Refs for camera controls
    const yaw = useRef(new THREE.Object3D());
    const pitch = useRef(new THREE.Object3D());
    const lookDelta = useRef<{ x: number; y: number; prevClientX?: number; prevClientY?: number }>({ x: 0, y: 0 });


    // Refs for movement state
    const moveForward = useRef(false);
    const moveBackward = useRef(false);
    const moveLeft = useRef(false);
    const moveRight = useRef(false);

    // State for model list and selection
    const [modelList, setModelList] = useState<string[]>([]);
    const [selectedModelIndex, setSelectedModelIndex] = useState<number>(0);
    const [isPointerLocked, setIsPointerLocked] = useState(false);
    // const isPortrait = useIsPortrait(); // No longer directly used in rendering condition for controls
    const isControlsVisible = useBreakpointValue({ base: true, md: false });

    // NEW: State for controlling collision object visibility
    const [showColliders, setShowColliders] = useState(false); // Set to true by default to see them initially
    // NEW: Loading state for spinner
    const [isLoading, setIsLoading] = useState(true); // Initial state set to true
    // 0–1 while a model downloads; null when unknown or idle.
    const [loadProgress, setLoadProgress] = useState<number | null>(null);
    // Collider overlay is a developer aid: only reachable with ?debug=1.
    const [debugTools] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug"));

    // Animation frame ID for cleanup
    const animationFrameId = useRef<number | null>(null);

    const loadModel = useCallback(async (modelName: string, modelIndex: number, scene: THREE.Scene, world: CANNON.World) => {
        console.log("Attempting to load model:", modelName);
        setIsLoading(true); // Set loading to true when starting model load

        if (!scene || !world) {
            console.log("loadModel: Scene or World not initialized yet. Skipping model load.");
            setIsLoading(false); // Set loading to false if pre-conditions not met
            return;
        }

        console.log(`loadModel: Attempting to load model "${modelName}" at index ${modelIndex}`);

        // Remove previous Three.js model from scene
        if (gltfModelRef.current) {
            scene.remove(gltfModelRef.current);
            gltfModelRef.current.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose();
                    if (object.material instanceof THREE.Material) {
                        object.material.dispose();
                    } else if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    }
                }
            });
            console.log("loadModel: Removed previous Three.js model from scene and disposed resources.");
        }

        // NEW: Clear previous dynamic collision bodies and their visual meshes
        if (dynamicCollisionObjectsRef.current.length > 0) {
            dynamicCollisionObjectsRef.current.forEach(({ body, mesh }) => {
                world.removeBody(body);
                scene.remove(mesh);
                mesh.geometry.dispose();
                (mesh.material as THREE.Material).dispose();
            });
            dynamicCollisionObjectsRef.current = [];
            console.log("loadModel: Cleared previous dynamic collision visual meshes and bodies.");
        }

        const loader = new GLTFLoader();
        const modelPath = `/models/houses/${modelName}`;
        console.log(`loadModel: Loading GLTF from: "${modelPath}"`);

        try {
            setLoadProgress(0);
            const gltf = await loader.loadAsync(modelPath, (event) => {
                if (event.lengthComputable && event.total > 0) setLoadProgress(event.loaded / event.total);
            });
            const model = gltf.scene;

            // Apply scaling for a 1:1 mapping (1 Blender unit = 1 Three.js unit)
            model.scale.set(1, 1, 1);

            // Position model at scene origin
            model.position.set(0, 0, 0);

            scene.add(model);
            gltfModelRef.current = model;
            console.log("loadModel: GLTF model loaded and added to scene:", model);

            // NEW: Define collision material
            const collisionMaterial = new THREE.MeshBasicMaterial({
                color: 0xff0000, // Red
                transparent: true,
                opacity: 0.5,
                depthWrite: false // Helps with rendering overlapping transparent objects
            });

            // Create Cannon.js bodies from meshes in the loaded GLTF model
            let bodiesCreatedCount = 0;
            model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // For demonstration, skipping interior/furniture/windows/doors. Adjust as per your model's naming.
                    if (child.name.includes("Interior") || child.name.includes("Furniture") || child.name.includes("Window") || child.name.includes("Door")) {
                        console.log(`Skipping collision body for interior/furniture/window/door mesh: ${child.name}`);
                        return; // Skip creating a body for this mesh
                    }

                    // Ensure geometry is a BufferGeometry and has position attribute
                    if (!child.geometry || !(child.geometry instanceof THREE.BufferGeometry) || !child.geometry.attributes.position) {
                        console.warn(`Mesh ${child.name} has no valid BufferGeometry or position attribute. Skipping collision body.`);
                        return;
                    }

                    const geometry = child.geometry;
                    const vertices = geometry.attributes.position.array as Float32Array;
                    let indices: number[] = [];

                    if (geometry.index) {
                        indices = Array.from(geometry.index.array);
                    } else {
                        // If no index, create a simple one (assuming triangles)
                        for (let i = 0; i < vertices.length / 3; i++) {
                            indices.push(i);
                        }
                    }

                    // Create Cannon.js Trimesh shape
                    const shape = new CANNON.Trimesh(Array.from(vertices), indices);

                    // Calculate the world position and quaternion of the mesh
                    const worldPosition = new THREE.Vector3();
                    child.getWorldPosition(worldPosition);

                    const worldQuaternion = new THREE.Quaternion();
                    child.getWorldQuaternion(worldQuaternion);

                    const body = new CANNON.Body({
                        mass: 0, // Static object
                        shape: shape,
                        position: new CANNON.Vec3(worldPosition.x, worldPosition.y, worldPosition.z)
                    });
                    body.quaternion.set(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w);

                    world.addBody(body);

                    // NEW: Create visual mesh for this collider by cloning the original mesh's geometry
                    // This ensures the visual collider matches the actual mesh shape
                    const visualGeometry = child.geometry.clone();
                    const visualMesh = new THREE.Mesh(visualGeometry, collisionMaterial);
                    visualMesh.position.copy(worldPosition); // Position based on the Cannon.js body's world position
                    visualMesh.quaternion.copy(worldQuaternion); // Orientation based on the Cannon.js body's world quaternion
                    visualMesh.castShadow = false;
                    visualMesh.receiveShadow = false;
                    visualMesh.visible = showColliders; // Set initial visibility based on state
                    scene.add(visualMesh);
                    dynamicCollisionObjectsRef.current.push({ body: body, mesh: visualMesh });

                    bodiesCreatedCount++;
                    console.log(`loadModel: Added Cannon.js Trimesh body and visual for mesh: "${child.name}" at world position [${body.position.x.toFixed(2)}, ${body.position.y.toFixed(2)}, ${body.position.z.toFixed(2)}]`);
                }
            });
            console.log(`loadModel: Finished processing GLTF for collisions. Total Cannon.js bodies and visuals created: ${bodiesCreatedCount}`);

        } catch (error) {
            console.error("loadModel: Error loading GLTF model:", error);
        } finally {
            setLoadProgress(null);
            setIsLoading(false); // Set loading to false after model is loaded or an error occurs
        }
    }, [showColliders]); // Add showColliders to dependencies

    // Initial setup for Three.js and Cannon.js
    const initThreeAndCannon = useCallback(() => {
        console.log("initThreeAndCannon called");
        console.log("mountRef:", mountRef.current);
        if (!mountRef.current || sceneRef.current) {
            return;
        }

        console.log("App.tsx: Initializing Three.js and Cannon.js...");
        setIsLoading(true); // Set loading to true when initializing

        const textureLoader = new THREE.TextureLoader();

        // Three.js Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        cameraRef.current = camera;
        // Camera position will be synced with player body, so set relative to player's head
        camera.position.set(0, 1.6, 0); // ~1.6 meters eye height

        yaw.current.add(pitch.current);
        pitch.current.add(camera);
        scene.add(yaw.current); // Add yaw object to scene, which contains pitch and camera

        // Renderer
        // Match rendering cost to the device: weak GPUs get no antialiasing and a 1x pixel ratio.
        const deviceTier = detectDevice().ceiling;
        const weak = deviceTier === "static" || tierIndex(deviceTier) <= tierIndex("low");
        const renderer = new THREE.WebGLRenderer({ antialias: !weak, powerPreference: weak ? "default" : "high-performance" });
        rendererRef.current = renderer;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(weak ? 1 : Math.min(window.devicePixelRatio, deviceTier === "medium" ? 1.5 : 2));
        renderer.shadowMap.enabled = true; // Keep shadow map enabled for future use with other lights if needed
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Recommended for HDR
        renderer.toneMappingExposure = 1.2; // Adjust exposure as needed
        mountRef.current.appendChild(renderer.domElement);

        // Load HDR environment map
        new RGBELoader()
            .setPath('/hdri/') // Assuming your HDR file is in public/hdri/
            .load('venice_sunset_1k.hdr', (texture) => { // Replace with your HDR file name (e.g., 'venice_sunset_1k.hdr')
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture; // Global environment lighting
                scene.background = texture; // Set background to HDR as well
                console.log("App.tsx: HDR environment map loaded and applied.");
                setIsLoading(false); // Set loading to false after HDR is loaded
            }, undefined, (error) => {
                console.error("App.tsx: Error loading HDR environment map:", error);
                setIsLoading(false); // Set loading to false on error
            });

        // Cannon.js World
        const world = new CANNON.World();
        worldRef.current = world;
        world.gravity.set(0, -9.82, 0);
        world.broadphase = new CANNON.SAPBroadphase(world);
        world.defaultContactMaterial.friction = 0.5; // Keep default friction as is for other objects
        world.defaultContactMaterial.restitution = 0.1;

        // Define custom materials for player, ground, and walls
        const playerMaterial = new CANNON.Material("playerMaterial");
        const groundMaterial = new CANNON.Material("groundMaterial");
        const wallMaterial = new CANNON.Material("wallMaterial");
        // Material for the path
        const pathMaterial = new CANNON.Material("pathMaterial");
        // Material for the gate posts
        const gatePostMaterial = new CANNON.Material("gatePostMaterial");


        // Define ContactMaterials for specific interactions
        // Player vs. Ground
        const playerGroundContactMaterial = new CANNON.ContactMaterial(
            playerMaterial,
            groundMaterial,
            {
                friction: 0.1, // Low friction for smooth movement on ground
                restitution: 0.0, // No bounce
            }
        );
        world.addContactMaterial(playerGroundContactMaterial);

        // Player vs. Wall
        const playerWallContactMaterial = new CANNON.ContactMaterial(
            playerMaterial,
            wallMaterial,
            {
                friction: 0.2, // Moderate friction for walls (can adjust for "stickiness")
                restitution: 0.0, // No bounce
            }
        );
        world.addContactMaterial(playerWallContactMaterial);

        // Player vs. Path
        const playerPathContactMaterial = new CANNON.ContactMaterial(
            playerMaterial,
            pathMaterial,
            {
                friction: 0.6, // Higher friction for path to simulate different terrain
                restitution: 0.0,
            }
        );
        world.addContactMaterial(playerPathContactMaterial);

        // Player vs. Gate Post
        const playerGatePostContactMaterial = new CANNON.ContactMaterial(
            playerMaterial,
            gatePostMaterial,
            {
                friction: 0.2, // Moderate friction
                restitution: 0.0,
            }
        );
        world.addContactMaterial(playerGatePostContactMaterial);

        // Ground Plane (Physics)
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotate to be flat
        world.addBody(groundBody);
        groundBodyRef.current = groundBody; // Store ref for cleanup

        // Ground Plane (Visual)
        const groundGeometry = new THREE.PlaneGeometry(50, 50, 1, 1); // 50x50m plane

        const grassTexture = textureLoader.load('/textures/ground/grass_color.jpg');
        grassTexture.wrapS = THREE.RepeatWrapping;
        grassTexture.wrapT = THREE.RepeatWrapping;
        grassTexture.repeat.set(20, 20); // Adjust repeat values as needed for good tiling

        // NEW: Load the normal map texture
        const grassNormalMap = textureLoader.load('/textures/ground/grass_normal.jpg'); // Assuming you have a grass_normal.jpg
        grassNormalMap.wrapS = THREE.RepeatWrapping;
        grassNormalMap.wrapT = THREE.RepeatWrapping;
        grassNormalMap.repeat.set(20, 20); // Important: Match the repeat of the color texture

        const groundVisualMaterial = new THREE.MeshStandardMaterial({
            map: grassTexture,
            // NEW: Assign the normal map
            normalMap: grassNormalMap
        });

        const groundMesh = new THREE.Mesh(groundGeometry, groundVisualMaterial);
        groundMesh.rotation.x = -Math.PI / 2; // Rotate to be flat
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);
        groundMeshRef.current = groundMesh; // Store ref for cleanup


        // NEW: Collision Visualization Material
        const collisionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Red
            transparent: true,
            opacity: 0.5,
            depthWrite: false // Helps with rendering overlapping transparent objects
        });

        // Add Walls
        const WALL_HEIGHT = 3;
        const MAP_SIZE = 50;
        const WALL_THICKNESS = 0.5; // Thickness of the wall itself
        const GATE_WIDTH = 5; // Width of the gate opening (still defined for path/posts reference)
        const GATE_POST_THICKNESS = 1.0; // Made thicker
        const GATE_POST_HEIGHT = WALL_HEIGHT;

        // Calculate 5% thicker for the new object
        const GATE_FILL_THICKNESS = WALL_THICKNESS * 1.05;


        // Load brick texture for walls
        const brickTexture = textureLoader.load('/textures/brick_color.jpg',
            (tex) => { console.log("Brick texture loaded successfully."); },
            undefined,
            (err) => { console.error("Error loading brick texture:", err); }
        );
        brickTexture.wrapS = THREE.RepeatWrapping;
        brickTexture.wrapT = THREE.RepeatWrapping;
        brickTexture.repeat.set(10, 1);

        // Dedicated material for standard brick walls
        const brickWallMaterial = new THREE.MeshStandardMaterial({
            map: brickTexture
        });

        // Material for the brown gate wall (the "closed part")
        const brownGateMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513 // Saddle brown color
        });

        // Wall 1: Z+ side (continuous wall, now with brick texture again)
        const wall1Body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(MAP_SIZE / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2)), position: new CANNON.Vec3(0, WALL_HEIGHT / 2, MAP_SIZE / 2), material: wallMaterial });
        world.addBody(wall1Body);
        const wall1Geometry = new THREE.BoxGeometry(MAP_SIZE, WALL_HEIGHT, WALL_THICKNESS); // Full width
        const wall1Mesh = new THREE.Mesh(wall1Geometry, brickWallMaterial); // Apply brickWallMaterial
        wall1Mesh.position.copy(wall1Body.position as any);
        wall1Mesh.castShadow = true;
        scene.add(wall1Mesh);
        // NEW: Collision visual for Wall 1
        const wall1VisualMesh = new THREE.Mesh(wall1Geometry, collisionMaterial);
        wall1VisualMesh.position.copy(wall1Body.position as any);
        wall1VisualMesh.quaternion.copy(wall1Body.quaternion as any);
        wall1VisualMesh.castShadow = false;
        wall1VisualMesh.receiveShadow = false;
        wall1VisualMesh.visible = showColliders; // Set initial visibility
        scene.add(wall1VisualMesh);
        staticCollisionObjectsRef.current.push({ body: wall1Body, mesh: wall1VisualMesh });


        // Wall 2: Z- side
        const wall2Body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(MAP_SIZE / 2, WALL_HEIGHT / 2, WALL_THICKNESS / 2)), position: new CANNON.Vec3(0, WALL_HEIGHT / 2, -MAP_SIZE / 2), material: wallMaterial });
        world.addBody(wall2Body);
        const wall2Geometry = new THREE.BoxGeometry(MAP_SIZE, WALL_HEIGHT, WALL_THICKNESS);
        const wall2Mesh = new THREE.Mesh(wall2Geometry, brickWallMaterial);
        wall2Mesh.position.copy(wall2Body.position as any);
        wall2Mesh.castShadow = true;
        scene.add(wall2Mesh);
        // NEW: Collision visual for Wall 2
        const wall2VisualMesh = new THREE.Mesh(wall2Geometry, collisionMaterial);
        wall2VisualMesh.position.copy(wall2Body.position as any);
        wall2VisualMesh.quaternion.copy(wall2Body.quaternion as any);
        wall2VisualMesh.castShadow = false;
        wall2VisualMesh.receiveShadow = false;
        wall2VisualMesh.visible = showColliders; // Set initial visibility
        scene.add(wall2VisualMesh);
        staticCollisionObjectsRef.current.push({ body: wall2Body, mesh: wall2VisualMesh });


        // Wall 3: X+ side (rotated)
        const wall3Body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, MAP_SIZE / 2)), position: new CANNON.Vec3(MAP_SIZE / 2, WALL_HEIGHT / 2, 0), material: wallMaterial });
        world.addBody(wall3Body);
        const wall3Geometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, MAP_SIZE);
        const wall3Mesh = new THREE.Mesh(wall3Geometry, brickWallMaterial);
        wall3Mesh.position.copy(wall3Body.position as any);
        wall3Mesh.castShadow = true;
        scene.add(wall3Mesh);
        // NEW: Collision visual for Wall 3
        const wall3VisualMesh = new THREE.Mesh(wall3Geometry, collisionMaterial);
        wall3VisualMesh.position.copy(wall3Body.position as any);
        wall3VisualMesh.quaternion.copy(wall3Body.quaternion as any);
        wall3VisualMesh.castShadow = false;
        wall3VisualMesh.receiveShadow = false;
        wall3VisualMesh.visible = showColliders; // Set initial visibility
        scene.add(wall3VisualMesh);
        staticCollisionObjectsRef.current.push({ body: wall3Body, mesh: wall3VisualMesh });


        // Wall 4: X- side (rotated)
        const wall4Body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(WALL_THICKNESS / 2, WALL_HEIGHT / 2, MAP_SIZE / 2)), position: new CANNON.Vec3(-MAP_SIZE / 2, WALL_HEIGHT / 2, 0), material: wallMaterial });
        world.addBody(wall4Body);
        const wall4Geometry = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, MAP_SIZE);
        const wall4Mesh = new THREE.Mesh(wall4Geometry, brickWallMaterial);
        wall4Mesh.position.copy(wall4Body.position as any);
        wall4Mesh.castShadow = true;
        scene.add(wall4Mesh);
        // NEW: Collision visual for Wall 4
        const wall4VisualMesh = new THREE.Mesh(wall4Geometry, collisionMaterial);
        wall4VisualMesh.position.copy(wall4Body.position as any);
        wall4VisualMesh.quaternion.copy(wall4Body.quaternion as any);
        wall4VisualMesh.castShadow = false;
        wall4VisualMesh.receiveShadow = false;
        wall4VisualMesh.visible = showColliders; // Set initial visibility
        scene.add(wall4VisualMesh);
        staticCollisionObjectsRef.current.push({ body: wall4Body, mesh: wall4VisualMesh });


        // NEW: Separate brown object between the gate posts
        const gateFillBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(GATE_WIDTH / 2, WALL_HEIGHT / 2, GATE_FILL_THICKNESS / 2)), position: new CANNON.Vec3(0, WALL_HEIGHT / 2, MAP_SIZE / 2), material: wallMaterial });
        world.addBody(gateFillBody);
        const gateFillGeometry = new THREE.BoxGeometry(GATE_WIDTH, WALL_HEIGHT, GATE_FILL_THICKNESS);
        const gateFillMesh = new THREE.Mesh(gateFillGeometry, brownGateMaterial);
        gateFillMesh.position.copy(gateFillBody.position as any);
        gateFillMesh.castShadow = true;
        scene.add(gateFillMesh);
        // NEW: Collision visual for Gate Fill
        const gateFillVisualMesh = new THREE.Mesh(gateFillGeometry, collisionMaterial);
        gateFillVisualMesh.position.copy(gateFillBody.position as any);
        gateFillVisualMesh.quaternion.copy(gateFillBody.quaternion as any);
        gateFillVisualMesh.castShadow = false;
        gateFillVisualMesh.receiveShadow = false;
        gateFillVisualMesh.visible = showColliders; // Set initial visibility
        scene.add(gateFillVisualMesh);
        staticCollisionObjectsRef.current.push({ body: gateFillBody, mesh: gateFillVisualMesh });


        // Add a path from the gate to the center
        const PATH_WIDTH = GATE_WIDTH;
        const PATH_LENGTH = MAP_SIZE / 2; // From Z+ wall to center (0,0,0)
        const pathBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(PATH_WIDTH / 2, 0.05, PATH_LENGTH / 2)), position: new CANNON.Vec3(0, 0.001, MAP_SIZE / 4), material: pathMaterial });
        world.addBody(pathBody);
        const pathGeometry = new THREE.BoxGeometry(PATH_WIDTH, 0.02, PATH_LENGTH); // Thin box for visual path
        const pathTexture = textureLoader.load('/textures/path_color.jpg');
        pathTexture.wrapS = THREE.RepeatWrapping;
        pathTexture.wrapT = THREE.RepeatWrapping;
        pathTexture.repeat.set(1, 5); // Adjust repeat values as needed

        const pathVisualMaterial = new THREE.MeshStandardMaterial({
            map: pathTexture
        });

        const pathMesh = new THREE.Mesh(pathGeometry, pathVisualMaterial);
        pathMesh.position.copy(pathBody.position as any);
        pathMesh.receiveShadow = true;
        scene.add(pathMesh);
        // NEW: Collision visual for Path
        const pathVisualMesh = new THREE.Mesh(pathGeometry, collisionMaterial);
        pathVisualMesh.position.copy(pathBody.position as any);
        pathVisualMesh.quaternion.copy(pathBody.quaternion as any);
        pathVisualMesh.castShadow = false;
        pathVisualMesh.receiveShadow = false;
        pathVisualMesh.visible = showColliders; // Set initial visibility
        scene.add(pathVisualMesh);
        staticCollisionObjectsRef.current.push({ body: pathBody, mesh: pathVisualMesh });


        // Add Black Gate Posts (Thicker, still at former gate location)
        const gatePostGeometry = new THREE.BoxGeometry(GATE_POST_THICKNESS, GATE_POST_HEIGHT, GATE_POST_THICKNESS);
        const gatePostVisualMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 }); // Black color for gate posts

        // Left Gate Post
        const leftGatePostBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(GATE_POST_THICKNESS / 2, GATE_POST_HEIGHT / 2, GATE_POST_THICKNESS / 2)), position: new CANNON.Vec3(-GATE_WIDTH / 2 - GATE_POST_THICKNESS / 2, GATE_POST_HEIGHT / 2, MAP_SIZE / 2), material: gatePostMaterial });
        world.addBody(leftGatePostBody);
        const leftGatePostMesh = new THREE.Mesh(gatePostGeometry, gatePostVisualMaterial);
        leftGatePostMesh.position.copy(leftGatePostBody.position as any);
        leftGatePostMesh.castShadow = true;
        scene.add(leftGatePostMesh);
        // NEW: Collision visual for Left Gate Post
        const leftGatePostVisualMesh = new THREE.Mesh(gatePostGeometry, collisionMaterial);
        leftGatePostVisualMesh.position.copy(leftGatePostBody.position as any);
        leftGatePostVisualMesh.quaternion.copy(leftGatePostBody.quaternion as any);
        leftGatePostVisualMesh.castShadow = false;
        leftGatePostVisualMesh.receiveShadow = false;
        leftGatePostVisualMesh.visible = showColliders; // Set initial visibility
        scene.add(leftGatePostVisualMesh);
        staticCollisionObjectsRef.current.push({ body: leftGatePostBody, mesh: leftGatePostVisualMesh });


        // Right Gate Post
        const rightGatePostBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(GATE_POST_THICKNESS / 2, GATE_POST_HEIGHT / 2, GATE_POST_THICKNESS / 2)), position: new CANNON.Vec3(GATE_WIDTH / 2 + GATE_POST_THICKNESS / 2, GATE_POST_HEIGHT / 2, MAP_SIZE / 2), material: gatePostMaterial });
        world.addBody(rightGatePostBody);
        const rightGatePostMesh = new THREE.Mesh(gatePostGeometry, gatePostVisualMaterial);
        rightGatePostMesh.position.copy(rightGatePostBody.position as any);
        rightGatePostMesh.castShadow = true;
        scene.add(rightGatePostMesh);
        // NEW: Collision visual for Right Gate Post
        const rightGatePostVisualMesh = new THREE.Mesh(gatePostGeometry, collisionMaterial);
        rightGatePostVisualMesh.position.copy(rightGatePostBody.position as any);
        rightGatePostVisualMesh.quaternion.copy(rightGatePostBody.quaternion as any);
        rightGatePostVisualMesh.castShadow = false;
        rightGatePostVisualMesh.receiveShadow = false;
        rightGatePostVisualMesh.visible = showColliders; // Set initial visibility
        scene.add(rightGatePostVisualMesh);
        staticCollisionObjectsRef.current.push({ body: rightGatePostBody, mesh: rightGatePostVisualMesh });

        // Player Body
        playerBodyRef.current = new CANNON.Body({
            mass: 5,
            shape: new CANNON.Sphere(0.4),
            position: new CANNON.Vec3(0, 5, 22),
            linearDamping: 0.1,
            material: playerMaterial,
        });
        world.addBody(playerBodyRef.current);

        // NEW: Player Sphere Visual
        const playerGeometry = new THREE.SphereGeometry(0.4); // Same radius as CANNON.Sphere
        const playerVisualMesh = new THREE.Mesh(playerGeometry, collisionMaterial);
        playerVisualMesh.castShadow = false;
        playerVisualMesh.receiveShadow = false;
        playerVisualMesh.visible = showColliders; // Set initial visibility
        scene.add(playerVisualMesh);
        playerVisualMeshRef.current = playerVisualMesh;


        console.log("App.tsx: Three.js and Cannon.js initialized.");

    }, [showColliders]); // Add showColliders to dependencies

    // Animation loop
    const animate = useCallback(() => {
        animationFrameId.current = requestAnimationFrame(animate);

        const scene = sceneRef.current;
        const camera = cameraRef.current;
        const renderer = rendererRef.current;
        const world = worldRef.current;
        const playerBody = playerBodyRef.current;

        if (!scene || !camera || !renderer || !world || !playerBody) {
            return;
        }

        // Update physics
        const fixedTimeStep = 1 / 60;
        const maxSubSteps = 10;
        world.step(fixedTimeStep, performance.now() / 1000, maxSubSteps);

        // Sync player body with camera
        yaw.current.position.set(
            playerBody.position.x,
            playerBody.position.y - 0.3, // Adjust Y position relative to player body center to achieve desired eye height
            playerBody.position.z
        );

        // NEW: Sync player visual mesh and apply visibility
        if (playerVisualMeshRef.current) {
            playerVisualMeshRef.current.position.copy(playerBody.position as any);
            playerVisualMeshRef.current.quaternion.copy(playerBody.quaternion as any);
            playerVisualMeshRef.current.visible = showColliders;
        }

        // NEW: Sync static collision visuals and apply visibility
        staticCollisionObjectsRef.current.forEach(({ body, mesh }) => {
            mesh.position.copy(body.position as any);
            mesh.quaternion.copy(body.quaternion as any);
            mesh.visible = showColliders;
        });

        // NEW: Sync dynamic (model) collision visuals and apply visibility
        dynamicCollisionObjectsRef.current.forEach(({ body, mesh }) => {
            mesh.position.copy(body.position as any);
            mesh.quaternion.copy(body.quaternion as any);
            mesh.visible = showColliders;
        });


        // Apply movement with realistic walking speed (1.4 m/s)
        const moveSpeed = 0.4; // Realistic walking speed in m/s
        const velocity = new CANNON.Vec3(0, playerBody.velocity.y, 0);

        // Calculate movement direction based on camera orientation
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyQuaternion(yaw.current.quaternion);
        forwardVector.y = 0;
        forwardVector.normalize();

        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyQuaternion(yaw.current.quaternion);
        rightVector.y = 0;
        rightVector.normalize();

        // Calculate movement vector based on input
        if (moveForward.current) {
            velocity.x += forwardVector.x * moveSpeed;
            velocity.z += forwardVector.z * moveSpeed;
        }
        if (moveBackward.current) {
            velocity.x -= forwardVector.x * moveSpeed;
            velocity.z -= forwardVector.z * moveSpeed;
        }
        if (moveLeft.current) {
            velocity.x -= rightVector.x * moveSpeed;
            velocity.z -= rightVector.z * moveSpeed;
        }
        if (moveRight.current) {
            velocity.x += rightVector.x * moveSpeed;
            velocity.z += rightVector.z * moveSpeed;
        }

        playerBody.velocity.x = velocity.x;
        playerBody.velocity.z = velocity.z;

        // Apply look delta (now with continuous rotation)
        if (lookDelta.current.x !== 0 || lookDelta.current.y !== 0) {
            yaw.current.rotation.y -= lookDelta.current.x * lookSpeed; // Use lookSpeed
            pitch.current.rotation.x -= lookDelta.current.y * lookSpeed; // Use lookSpeed
            pitch.current.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch.current.rotation.x));
            // Add these lines to reset lookDelta after applying
            lookDelta.current.x = 0; // Reset horizontal look delta
            lookDelta.current.y = 0; // Reset vertical look delta
        }

        // Render the scene
        renderer.render(scene, camera);
    }, [showColliders]); // Add showColliders to dependencies

    // Effect for initializing Three.js and Cannon.js
    useEffect(() => {
        initThreeAndCannon();
        const currentMountRef = mountRef.current; // Capture current ref value for cleanup
        animationFrameId.current = requestAnimationFrame(animate); // Start animation loop

        // Capture the current scene reference for cleanup closure
        const sceneForCleanup = sceneRef.current;

        // Cleanup function
        return () => {
            console.log("App.tsx: Three.js resources disposed.");
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
                // Use the captured ref value in cleanup
                if (currentMountRef && rendererRef.current.domElement) {
                    currentMountRef.removeChild(rendererRef.current.domElement);
                }
            }

            const world = worldRef.current; // Capture world instance


            // Nullify refs for proper cleanup
            sceneRef.current = null;
            cameraRef.current = null;
            rendererRef.current = null;
            worldRef.current = null;
            playerBodyRef.current = null;
            gltfModelRef.current = null;

            // Cleanup for Ground
            if (groundMeshRef.current) {
                // Use the captured sceneForCleanup
                if (sceneForCleanup && groundMeshRef.current) {
                    sceneForCleanup.remove(groundMeshRef.current);
                }
                groundMeshRef.current.geometry.dispose();
                (groundMeshRef.current.material as THREE.Material).dispose();
                groundMeshRef.current = null;
            }

            if (world && groundBodyRef.current) {
                world.removeBody(groundBodyRef.current);
            }

            // NEW: Cleanup for player visual mesh
            if (playerVisualMeshRef.current) {
                // Use the captured sceneForCleanup
                if (sceneForCleanup && playerVisualMeshRef.current) {
                    sceneForCleanup.remove(playerVisualMeshRef.current);
                }
                playerVisualMeshRef.current.geometry.dispose();
                (playerVisualMeshRef.current.material as THREE.Material).dispose();
                playerVisualMeshRef.current = null;
            }

            // NEW: Cleanup for dynamic collision objects (model colliders)
            if (dynamicCollisionObjectsRef.current.length > 0) {
                dynamicCollisionObjectsRef.current.forEach(({ body, mesh }) => {
                    worldRef.current?.removeBody(body);
                    // Use the captured sceneForCleanup
                    if (sceneForCleanup && mesh) {
                        sceneForCleanup.remove(mesh);
                    }
                    mesh.geometry.dispose();
                    (mesh.material as THREE.Material).dispose();
                });
                dynamicCollisionObjectsRef.current = [];
            }

            // NEW: Cleanup for static collision objects (walls, etc.)
            if (staticCollisionObjectsRef.current.length > 0) {
                staticCollisionObjectsRef.current.forEach(({ body, mesh }) => {
                    worldRef.current?.removeBody(body);
                    // Use the captured sceneForCleanup
                    if (sceneForCleanup && mesh) {
                        sceneForCleanup.remove(mesh);
                    }
                    mesh.geometry.dispose();
                    (mesh.material as THREE.Material).dispose();
                });
                staticCollisionObjectsRef.current = [];
            }
        };

    }, [initThreeAndCannon, animate]);

    // Load model list from public/models/houses/index.json
    useEffect(() => {
        const fetchModelList = async () => {
            try {
                const response = await fetch("/models/houses/index.json");
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data: string[] = await response.json();
                setModelList(data);
                console.log("App.tsx: Model list loaded successfully:", data);
                if (data.length > 0) {
                    setSelectedModelIndex(0);
                    console.log("App.tsx: Initial model set to index 0.");
                } else {
                    console.log("App.tsx: No models available yet, skipping initial model load.");
                }
            } catch (error) {
                console.error("App.tsx: Failed to fetch model list:", error);
            } finally {
                // Do not set isLoading to false here, as model loading is separate
            }
        };
        fetchModelList();
    }, []);

    // Effect to trigger model load when selectedModelIndex or modelList changes
    useEffect(() => {
        if (modelList.length > 0 && selectedModelIndex >= 0 && selectedModelIndex < modelList.length) {
            console.log("App.tsx: Models list updated or selected model changed. Calling loadModel for index:", selectedModelIndex);
            if (sceneRef.current && worldRef.current) {
                loadModel(modelList[selectedModelIndex], selectedModelIndex, sceneRef.current, worldRef.current);
            }
        }
    }, [selectedModelIndex, modelList, loadModel]);

    // Event Listeners for window resize
    useEffect(() => {
        const handleResize = () => {
            const camera = cameraRef.current;
            const renderer = rendererRef.current;
            if (camera && renderer) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
                console.log("App.tsx: Window resized. Renderer updated.");
            }
        };

        window.addEventListener("resize", handleResize);
        console.log("App.tsx: Window resize listener added.");

        return () => {
            window.removeEventListener("resize", handleResize);
            console.log("App.tsx: Window resize listener removed.");
        };
    }, []);

    // Event Listeners for Pointer Lock (Mouse Look)
    useEffect(() => {
        const mountElement = mountRef.current;

        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === mountElement;
            setIsPointerLocked(locked);
            console.log("App.tsx: Pointer lock status changed:", locked);
        };

        const handlePointerLockError = () => {
            console.error("App.tsx: Pointer lock error.");
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (isPointerLocked && pitch.current && yaw.current) {
                const movementX = event.movementX || 0;
                const movementY = event.movementY || 0;

                yaw.current.rotation.y -= movementX * 0.002;
                pitch.current.rotation.x -= movementY * 0.002;

                // Clamp vertical look to prevent flipping
                pitch.current.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pitch.current.rotation.x));
            }
        };

        if (mountElement) {
            mountElement.addEventListener("click", () => {
                console.log("App.tsx: Requesting pointer lock on mountRef element.");
                mountElement.requestPointerLock();
            });
            document.addEventListener("pointerlockchange", handlePointerLockChange);
            document.addEventListener("pointerlockerror", handlePointerLockError);
            document.addEventListener("mousemove", handleMouseMove);
        }

        return () => {
            if (mountElement) {
                mountElement.removeEventListener("click", () => { /* no-op */ });
            }
            document.removeEventListener("pointerlockchange", handlePointerLockChange);
            document.removeEventListener("pointerlockerror", handlePointerLockError);
            document.removeEventListener("mousemove", handleMouseMove);
            console.log("App.tsx: Pointer lock listeners removed.");
        };
    }, [isPointerLocked]);

    // Event Listeners for Keyboard Controls
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            console.log(`App.tsx: KeyDown - Code: ${event.code}, Key: ${event.key}`);
            switch (event.code) {
                case "KeyW":
                    moveForward.current = true;
                    break;
                case "KeyS":
                    moveBackward.current = true;
                    break;
                case "KeyA":
                    moveLeft.current = true;
                    break;
                case "KeyD":
                    moveRight.current = true;
                    break;
                case "ArrowUp": // Flipped: ArrowUp now looks down
                    lookDelta.current.y = -1;
                    break;
                case "ArrowDown": // Flipped: ArrowDown now looks up
                    lookDelta.current.y = 1;
                    break;
                case "ArrowLeft": // Flipped: ArrowLeft now looks right
                    lookDelta.current.x = -1;
                    break;
                case "ArrowRight": // Flipped: ArrowRight now looks left
                    lookDelta.current.x = 1;
                    break;
                case "Digit1":
                    if (modelList.length > 0) {
                        setSelectedModelIndex(0);
                        console.log(`App.tsx: Key "1" pressed. Setting selected model to index 0.`);
                    }
                    break;
                case "Digit2":
                    if (modelList.length > 1) {
                        setSelectedModelIndex(1);
                        console.log(`App.tsx: Key "2" pressed. Setting selected model to index 1.`);
                    }
                    break;
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            console.log(`App.tsx: KeyUp - Code: ${event.code}, Key: ${event.key}`);
            switch (event.code) {
                case "KeyW":
                    moveForward.current = false;
                    break;
                case "KeyS":
                    moveBackward.current = false;
                    break;
                case "KeyA":
                    moveLeft.current = false;
                    break;
                case "KeyD":
                    moveRight.current = false;
                    break;
                case "ArrowUp":
                case "ArrowDown":
                    lookDelta.current.y = 0; // Stop vertical look
                    break;
                case "ArrowLeft":
                case "ArrowRight":
                    lookDelta.current.x = 0; // Stop horizontal look
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [modelList]);

    const hold = (flags: { current: boolean }[], on: boolean) => () => {
        flags.forEach((f) => { f.current = on; });
    };
    // Pointer events cover touch, pen and mouse, and keep working if the finger slides off the button.
    const pad = (label: string, icon: React.ReactElement, onDown: () => void, onUp: () => void) => (
        <IconButton
            aria-label={label}
            icon={icon}
            variant="glass"
            boxSize="56px"
            borderRadius="full"
            isDisabled={isLoading}
            sx={{ touchAction: "none", userSelect: "none", WebkitTouchCallout: "none" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onDown(); }}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onUp}
            onContextMenu={(e) => e.preventDefault()}
        />
    );
    const look = (axis: "x" | "y", value: number) => () => { lookDelta.current[axis] = value; };

    return (
        <Box ref={mountRef} h="100dvh" w="100vw" overflow="hidden" position="relative" sx={{ touchAction: "none" }}>
            {/* Loading overlay with real progress */}
            {isLoading && (
                <Center position="absolute" inset={0} bg="rgba(10,10,10,0.82)" zIndex="overlay" role="status" aria-live="polite">
                    <Stack spacing={4} w="min(320px, 80vw)" textAlign="center">
                        <Text fontFamily="heading" fontSize="xl" fontWeight={700}>Preparing the house…</Text>
                        <Progress
                            value={loadProgress === null ? undefined : Math.round(loadProgress * 100)}
                            isIndeterminate={loadProgress === null}
                            size="sm"
                            borderRadius="full"
                            colorScheme="orange"
                            bg="whiteAlpha.200"
                            aria-label="Loading progress"
                        />
                        <Text fontSize="sm" color="content.secondary">
                            {loadProgress === null ? "Loading scene" : `${Math.round(loadProgress * 100)}% of the model downloaded`}
                        </Text>
                    </Stack>
                </Center>
            )}

            {/* Top-left: model picker (and developer tools with ?debug=1) */}
            <Stack position="absolute" top={{ base: "76px", md: "80px" }} left={3} zIndex="tooltip" spacing={2} align="flex-start" maxW="calc(100vw - 24px)">
                {modelList.length > 1 && (
                    <Box role="group" aria-label="Choose a house">
                        <Text fontSize="xs" color="content.secondary" mb={1}>House</Text>
                        <ButtonGroup size="sm" isAttached variant="outline" flexWrap="wrap">
                            {modelList.map((modelName, index) => (
                                <Button
                                    key={modelName}
                                    aria-pressed={selectedModelIndex === index}
                                    onClick={() => setSelectedModelIndex(index)}
                                    isDisabled={isLoading}
                                    bg={selectedModelIndex === index ? "accent.subtle" : "surface.glass"}
                                    borderColor={selectedModelIndex === index ? "accent.fg" : "line.strong"}
                                    backdropFilter="blur(8px)"
                                >
                                    {modelName.replace(".glb", "")}
                                </Button>
                            ))}
                        </ButtonGroup>
                    </Box>
                )}
                {debugTools && (
                    <Button onClick={() => setShowColliders((prev) => !prev)} aria-pressed={showColliders} variant="glass" size="sm">
                        {showColliders ? "Hide colliders" : "Show colliders"}
                    </Button>
                )}
            </Stack>

            {/* Desktop hint */}
            {!isControlsVisible && !isLoading && (
                <HStack position="absolute" bottom={5} left="50%" transform="translateX(-50%)" zIndex="tooltip" bg="surface.glass" border="1px solid" borderColor="line.subtle" borderRadius="full" px={5} py={2} backdropFilter="blur(10px)" pointerEvents="none" opacity={isPointerLocked ? 0.55 : 1} transition="opacity 200ms">
                    <Text fontSize="sm" color="content.secondary">
                        {isPointerLocked ? "Esc to release the mouse" : "Click the scene to look around · W A S D to walk"}
                    </Text>
                </HStack>
            )}

            {/* Touch controls: walk on the left, look on the right */}
            {isControlsVisible && (
                <>
                    <VisuallyHidden>Touch controls: hold the buttons to walk or look around.</VisuallyHidden>
                    <Stack position="absolute" left={4} bottom="calc(24px + env(safe-area-inset-bottom))" zIndex="10" spacing={3}>
                        {pad("Walk forward", <FiChevronUp size={26} />, () => { moveForward.current = true; moveBackward.current = false; }, hold([moveForward], false))}
                        {pad("Walk backward", <FiChevronDown size={26} />, () => { moveBackward.current = true; moveForward.current = false; }, hold([moveBackward], false))}
                    </Stack>
                    <Box position="absolute" right={4} bottom="calc(24px + env(safe-area-inset-bottom))" zIndex="10" w="184px" h="184px">
                        <Box position="absolute" top={0} left="64px">{pad("Look up", <FiArrowUp size={22} />, look("y", -1), look("y", 0))}</Box>
                        <Box position="absolute" bottom={0} left="64px">{pad("Look down", <FiArrowDown size={22} />, look("y", 1), look("y", 0))}</Box>
                        <Box position="absolute" top="64px" left={0}>{pad("Look left", <FiArrowLeft size={22} />, look("x", -1), look("x", 0))}</Box>
                        <Box position="absolute" top="64px" right={0}>{pad("Look right", <FiArrowRight size={22} />, look("x", 1), look("x", 0))}</Box>
                    </Box>
                </>
            )}
        </Box>
    );
}
