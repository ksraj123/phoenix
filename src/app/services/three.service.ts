import { Injectable } from '@angular/core';
import * as TWEEN from '@tweenjs/tween.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import {
  Group,
  Object3D,
  Vector3,
  Plane,
  Quaternion,
  AmbientLight,
  DirectionalLight,
  AxesHelper
} from 'three';
import { Configuration } from './extras/configuration.model';
import { ControlsManager } from './three/controls-manager';
import { RendererManager } from './three/renderer-manager';
import { ExportManager } from './three/export-manager';
import { ImportManager } from './three/import-manager';
import { SelectionManager } from './three/selection-manager';
import { SceneManager } from './three/scene-manager';
import { InfoLoggerService } from './infologger.service';

/**
 * Service for all three.js related functions.
 */
@Injectable({
  providedIn: 'root'
})
export class ThreeService {
  // Managers
  /** Manager for three.js scene */
  private sceneManager: SceneManager;
  /** Manager for three.js renderers */
  private rendererManager: RendererManager;
  /** Manager for three.js controls */
  private controlsManager: ControlsManager;
  /** Manager for export operations */
  private exportManager: ExportManager;
  /** Manager for import operations */
  private importManager: ImportManager;
  /** Manager for selection of 3D objects and event data */
  private selectionManager: SelectionManager;
  /** Service for logging data to the information panel */
  private infoLogger: InfoLoggerService;
  /** Scene export ignore list */
  private ignoreList = [
    new AmbientLight().type,
    new DirectionalLight().type,
    new AxesHelper().type
  ];
  /** Clipping planes for clipping geometry */
  private clipPlanes: Plane[] = [
    new Plane(new Vector3(0, 1, 0), 0),
    new Plane(new Vector3(0, -1, 0), 0),
    new Plane(new Vector3(0, 0, 1), -15000)
  ];

  /**
   * Initializes the necessary three.js functionality.
   * @param configuration Configuration to customize different aspects.
   * @param infoLogger Service for logging data to the information panel.
   */
  public init(configuration: Configuration, infoLogger: InfoLoggerService) {
    // Scene manager
    this.sceneManager = new SceneManager(this.ignoreList);
    // IO Managers
    this.exportManager = new ExportManager();
    this.importManager = new ImportManager(this.clipPlanes, SceneManager.EVENT_DATA_ID, SceneManager.GEOMETRIES_ID);
    // Renderer manager
    this.rendererManager = new RendererManager();
    // Controls manager
    this.controlsManager = new ControlsManager(this.rendererManager);
    // Logger
    this.infoLogger = infoLogger;
    // Selection manager
    this.getSelectionManager().init(
      this.controlsManager.getMainCamera(),
      this.sceneManager.getScene(),
      this.rendererManager.getMainRenderer(),
      this.infoLogger);
    // Customizing with configuration
    this.setConfiguration(configuration);
  }

  /**
   * Updates controls
   */
  public updateControls() {
    this.controlsManager.getActiveControls().update();
    this.controlsManager.updateSync();
    TWEEN.update();
  }

  /**
   * Renders three service.
   */
  public render() {
    this.rendererManager.render(this.sceneManager.getScene(), this.controlsManager);
    this.selectionManager.render(this.sceneManager.getScene(), this.controlsManager);
  }

  /**
   * Get the scene manager and create if it doesn't exist.
   * @returns The scene manager for managing different aspects and elements of the scene.
   */
  public getSceneManager(): SceneManager {
    if (!this.sceneManager) {
      this.sceneManager = new SceneManager(this.ignoreList);
    }
    return this.sceneManager;
  }

  /**
   * Sets controls to auto rotate.
   * @param autoRotate If the controls are to be automatically rotated or not.
   */
  public autoRotate(autoRotate: boolean) {
    this.controlsManager.getActiveControls().autoRotate = autoRotate;
  }

  /**
   * Enables geometries to be clipped with clipping planes.
   * @param clippingEnabled If the the geometry clipping is to be enabled or disabled.
   */
  public setClipping(clippingEnabled: boolean) {
    this.rendererManager.setLocalClippingEnabled(clippingEnabled);
  }

  /**
   * Set if the clipped detector geometry is to be closed or not.
   * @param closed Boolean to specify if the clipped geometries will be closed.
   */
  public closeClippedGeometries(closed: boolean) {
    this.getSceneManager().closeClippedGeometries(closed);
  }

  /**
   * Rotates clipping planes.
   * @param angle Angle to rotate the clipping planes.
   */
  public rotateClipping(angle: number) {
    const q = new Quaternion();
    q.setFromAxisAngle(new Vector3(0, 0, 1), (angle * Math.PI) / 180);
    this.clipPlanes[0].normal.set(0, 1, 0).applyQuaternion(q);
  }


  /**
   * Animates camera transform.
   * @param cameraPosition End position.
   * @param cameraTarget End target.
   * @param duration Duration of an animation in seconds.
   */
  public animateCameraTransform(
    cameraPosition: number[],
    cameraTarget: number[],
    duration: number
  ) {
    this.animateCameraPosition(cameraPosition, duration);
    this.animateCameraTarget(cameraTarget, duration);
  }

  /**
   * Swaps cameras.
   * @param useOrthographic Whether to use orthographic or perspective camera.
   */
  public swapCameras(useOrthographic: boolean) {
    let cameraType: string;

    if (useOrthographic) {
      // perspective -> ortho
      cameraType = 'OrthographicCamera';
    } else {
      // ortho -> perspective
      cameraType = 'PerspectiveCamera';
    }

    if (this.controlsManager.getMainCamera().type !== cameraType) {
      this.controlsManager.swapControls();
    }
  }

  /**
   * Sets animation loop for vr playground.
   * @param animate Function to render the loop.
   */
  public setAnimationLoop(animate: () => void) {
    this.rendererManager.getMainRenderer().xr.enabled = true;
    this.rendererManager.getMainRenderer().setAnimationLoop(animate);
  }

  /**
   * Displays a button to toggle VR.
   */
  public setVRButton() {
    let canvas = document.getElementById('eventDisplay');
    if (canvas == null) {
      canvas = document.body;
    }
    canvas.appendChild(
      VRButton.createButton(this.rendererManager.getMainRenderer())
    );
  }

  // *************************************
  // * Functions for loading geometries. *
  // *************************************

  /**
   * Loads an OBJ (.obj) geometry from the given filename.
   * @param filename Path to the geometry.
   * @param name Name given to the geometry.
   * @param color Color to initialize the geometry.
   * @param doubleSided Renders both sides of the material.
   */
  public loadOBJGeometry(
    filename: string,
    name: string,
    color: any,
    doubleSided: boolean
  ): void {
    const geometries = this.sceneManager.getGeometries();
    const callback = (object: Group) => geometries.add(object);
    this.importManager.loadOBJGeometry(callback, filename, name, color, doubleSided);
  }

  /**
   * Loads a GLTF (.gltf) scene/geometry from the given URL.
   * @param sceneUrl URL to the GLTF (.gltf) file.
   * @param name Name of the loaded scene/geometry.
   */
  public loadGLTFGeometry(sceneUrl: any, name: string) {
    const geometries = this.sceneManager.getGeometries();
    const callback = (geometry: Object3D) => geometries.add(geometry);
    this.importManager.loadGLTFGeometry(sceneUrl, name, callback);
  }

  /**
   * Parses and loads a geometry in OBJ (.obj) format.
   * @param geometry Geometry in OBJ (.obj) format.
   * @param name Name given to the geometry.
   */
  public parseOBJGeometry(geometry: string, name: string) {
    const geometries = this.sceneManager.getGeometries();
    const object = this.importManager.parseOBJGeometry(geometry, name);
    geometries.add(object);
  }

  /**
   * Parses and loads a geometry in GLTF (.gltf) format.
   * @param geometry Geometry in GLTF (.gltf) format.
   */
  public parseGLTFGeometry(geometry: any) {
    const callback = (geometries: Object3D, eventData: Object3D) => {
      this.sceneManager.getScene().add(geometries);
      this.sceneManager.getScene().add(eventData);
    };
    this.importManager.parseGLTFGeometry(geometry, callback);
  }

  /**
   * Exports scene to OBJ file format.
   */
  public exportSceneToOBJ() {
    const scene = this.sceneManager.getCleanScene();
    this.exportManager.exportSceneToOBJ(scene);
  }

  /**
   * Exports scene as phoenix format, allowing to load it later and recover the saved configuration.
   */
  public exportPhoenixScene() {
    const scene = this.sceneManager.getCleanScene();
    this.exportManager.exportPhoenixScene(
      scene, this.sceneManager.getEventData(),
      this.sceneManager.getGeometries());
  }

  /**
   * Fixes the camera position of the overlay view.
   * @param fixed Whether the overlay view is to be fixed or not.
   */
  public fixOverlayView(fixed: boolean) {
    this.rendererManager.setFixOverlay(fixed);
  }

  /**
   * Initializes the object which will show information of the selected geometry/event data.
   * @param selectedObject Object to display the data.
   */
  public setSelectedObjectDisplay(selectedObject: { name: string, attributes: any[] }) {
    this.getSelectionManager().setSelectedObject(selectedObject);
  }

  /**
   * Set event data depthTest to enable or disable if event data should show on top of geometry.
   * @param value A boolean to specify if depthTest is to be enabled or disabled.
   */
  public eventDataDepthTest(value: boolean) {
    this.sceneManager.eventDataDepthTest(value);
  }

  /**
   * Toggles the ability of selecting geometries/event data by clicking on the screen.
   * @param enable Value to enable or disable the functionality.
   */
  public enableSelecting(enable: boolean) {
    this.getSelectionManager().setSelecting(enable);
  }

  /**
   * Clears event data of the scene.
   */
  public clearEventData() {
    this.sceneManager.clearEventData();
  }

  /**
   * Adds group of an event data type to the main group containing event data.
   * @param typeName Type of event data.
   * @returns Three.js group containing the type of event data.
   */
  addEventDataTypeGroup(typeName: string): Group {
    return this.sceneManager.addEventDataTypeGroup(typeName);
  }

  /**
   * Sets the renderer to be used to render the event display on the overlayed canvas.
   * @param overlayCanvas An HTML canvas on which the overlay renderer is to be set.
   */
  public setOverlayRenderer(overlayCanvas: HTMLCanvasElement) {
    if (this.rendererManager) {
      this.rendererManager.setOverlayRenderer(overlayCanvas);
    }
  }

  // *********************************
  // * Private auxiliary functions.  *
  // *********************************

  /**
   * Sets different parameters according to the configuration.
   * @param configuration Configuration object.
   */
  private setConfiguration(configuration: Configuration) {
  }

  /**
   * Get the selection manager.
   * @returns Selection manager responsible for managing selection of 3D objects.
   */
  private getSelectionManager(): SelectionManager {
    if (!this.selectionManager) {
      this.selectionManager = new SelectionManager();
    }
    return this.selectionManager;
  }

  /**
   * Animates camera position.
   * @param cameraPosition End position.
   * @param duration Duration of an animation in seconds.
   */
  private animateCameraPosition(cameraPosition: number[], duration: number) {
    const posAnimation = new TWEEN.Tween(
      this.controlsManager.getActiveCamera().position
    );
    posAnimation.to(
      {
        x: cameraPosition[0],
        y: cameraPosition[1],
        z: cameraPosition[2]
      },
      duration
    );
    posAnimation.start();
  }

  /**
   * Animates camera target.
   * @param cameraTarget End target.
   * @param duration Duration of an animation in seconds.
   */
  private animateCameraTarget(cameraTarget: number[], duration: number) {
    const rotAnimation = new TWEEN.Tween(
      this.controlsManager.getActiveControls().target
    );
    rotAnimation.to(
      {
        x: cameraTarget[0],
        y: cameraTarget[1],
        z: cameraTarget[2]
      },
      duration
    );
    rotAnimation.start();
  }
}
