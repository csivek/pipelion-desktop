'use strict';

const WIDTH = 480;
const HEIGHT = 480;
const ASPECT_RATIO = HEIGHT / WIDTH;
const MAX_TRACE = 3;


function Material(type, diffuse, specularHighlight, phongConstant) {
  this.type = type;
  this.diffuse = diffuse.map(Number);
  this.specularHighlight = specularHighlight;
  this.phongConstant = phongConstant;
}

function Sphere(center, radius, material) {
  this.center = center.map(Number);
  this.radius = radius;
  this.material = material;
}

function Triangle(p1, p2, p3, material) {
  this.p1 = p1.map(Number);
  this.p2 = p2.map(Number);
  this.p3 = p3.map(Number);
  this.material = material;
}

let renderCanvas = document.getElementById("renderCanvas");
let ctx = renderCanvas.getContext("2d");
let imgData = ctx.createImageData(WIDTH, HEIGHT);

let camera, lights;
let sceneObjects = [];

document.getElementById("sceneFile").onchange = function() {
  let fileReader = new FileReader();

  fileReader.onload = function() {

    sessionStorage.clear();
    let lines = this.result.split('\n');

    camera = {
      lookAt: lines[0].split(' ').slice(1).map(Number),
      lookFrom: lines[1].split(' ').slice(1).map(Number),
      lookUp: lines[2].split(' ').slice(1).map(Number),
      fov: lines[3].split(' ')[1],
    }

    lights = {
      directionToLight: lines[4].split(' ').slice(1,4).map(Number),
      lightColor: lines[4].split(' ').slice(5).map(Number),
      ambientLight: lines[5].split(' ').slice(1).map(Number),
      backgroundColor: lines[6].split(' ').slice(1).map(Number),
    }

    lights.directionToLight = math.divide(lights.directionToLight,Math.sqrt(math.dot(lights.directionToLight,lights.directionToLight)));

    sceneObjects = [];
    for (let i = 7; i < lines.length; i++) {
      let line = lines[i].split(' ');
      if (line[0].toLowerCase() == "sphere") {
        let newSphere = new Sphere(
          line.slice(2,5), line[6],
          new Material(line[8], line.slice(9,12),line.slice(13,16), line[17]));
        sceneObjects.push(newSphere);
      } else if (line[0].toLowerCase() == "triangle"){ //Assume Triangle
        let newTriangle = new Triangle(
          line.slice(1,4), line.slice(4,7), line.slice(7,10),
          new Material(line[11], line.slice(12,15),line.slice(16,19), line[20]));
        sceneObjects.push(newTriangle);
      }
    }

  };
  fileReader.readAsText(this.files[0]);

  requestAnimationFrame(drawRender);

};

function drawRender() {
  ctx.putImageData(imgData,0,0);
  requestAnimationFrame(drawRender);
}

function raytrace(origin, direction, tracenum) {
  let closestObject;
  let closestDist = [Infinity, [0,0,0], [0,0,0]];
  let dist = [Infinity, [0,0,0], [0,0,0]];
  //console.log(origin);
  //console.log(direction);
  for (let i = sceneObjects.length - 1; i >= 0; i--){
    dist = calcDistance(origin, direction, sceneObjects[i]);
    if (dist[0] < closestDist[0]){
      closestDist = dist;
      closestObject = sceneObjects[i];
    }
  }
  if (closestDist[0] < Infinity){

    if (closestObject.material.type == "Reflective") {
      if (tracenum + 1 > MAX_TRACE) { return [0,0,0]; }
      let recursiveColor = raytrace(closestDist[2],reflect(direction, closestDist[1]),tracenum + 1);
      return [closestObject.material.diffuse[0]*recursiveColor[0],closestObject.material.diffuse[1]*recursiveColor[1],closestObject.material.diffuse[2]*recursiveColor[2]];
    }

    let isInShadow = false;
    for (let i = sceneObjects.length - 1; i >= 0; i--){
      dist = calcDistance(closestDist[2], lights.directionToLight, sceneObjects[i]);
      if (dist[0] < Infinity){
        isInShadow = true;
        break;
      }
    }
    let color = lights.ambientLight;
    if (isInShadow) {
      return [color[0] * closestObject.material.diffuse[0], color[1] * closestObject.material.diffuse[1], color[2] * closestObject.material.diffuse[2]];
    }
    color = math.add(color, math.multiply(lights.lightColor, Math.max(0,math.dot(closestDist[1],lights.directionToLight))));
    color = [color[0] * closestObject.material.diffuse[0], color[1] * closestObject.material.diffuse[1], color[2] * closestObject.material.diffuse[2]];
    let specColor = math.multiply(closestObject.material.specularHighlight, math.pow(math.max(0, math.dot(direction, reflect(lights.directionToLight, closestDist[1]))),closestObject.material.phongConstant));
    color = math.add(color, [lights.lightColor[0] * specColor[0], lights.lightColor[1] * specColor[1], lights.lightColor[2] * specColor[2]]);
    return color;
  } else {
    return lights.backgroundColor;
  }
}

function reflect(incidentVec, normal)
{
  return math.subtract(incidentVec, math.multiply(math.dot(incidentVec, normal)*2, normal));
}

function calcDistance(origin, direction, sceneObject) {

  const EPSILON = 0.0000001;
  if (sceneObject instanceof Sphere) {
    let vectorToSphere = math.subtract(sceneObject.center, origin);
    let magnitudeVTS = Math.sqrt(math.dot(vectorToSphere,vectorToSphere));
    let tca = math.dot(vectorToSphere, direction);
    if (tca < 0) { return [Infinity]; }
    let d2 = (magnitudeVTS * magnitudeVTS) - (tca*tca);
    if (Math.abs(d2) > (sceneObject.radius * sceneObject.radius)) { return [Infinity, [0,0,0]]; }
    let thc = Math.sqrt((sceneObject.radius * sceneObject.radius) - d2);
    let t0 = tca - thc;
    let t1 = tca + thc;
    if (t0 < t1 && t0 > EPSILON) {
      let point = math.add(origin, math.multiply(direction, t0));
      return [t0, math.divide(math.subtract(point,sceneObject.center), sceneObject.radius), point];
    }
    if (t1 > EPSILON) {
      let point = math.add(origin, math.multiply(direction, t1));
      return [t1, math.divide(math.subtract(point,sceneObject.center), sceneObject.radius), point];
    }
    return [Infinity];

  } else if (sceneObject instanceof Triangle) {
    let vertex0 = sceneObject.p1;
    let vertex1 = sceneObject.p2;
    let vertex2 = sceneObject.p3;
    let edge1, edge2, h, s, q;
    let a,f,u,v;
    edge1 = math.subtract(vertex1, vertex0);
    edge2 = math.subtract(vertex2, vertex0);
    h = math.cross(direction, edge2);
    a = math.dot(edge1, h);
    if (a > -EPSILON && a < EPSILON) {
      return [Infinity];
    }
    f = 1.0/a;
    s = math.subtract(origin, vertex0);
    u = f * (math.dot(s, h));
    if (u < 0.0 || u > 1.0) {
      return [Infinity];
    }
    q = math.cross(s, edge1);
    v = f * math.dot(direction, q);
    if (v < 0.0 || u + v > 1.0) {
      return [Infinity];
    }
    let t = f * math.dot(edge2, q);
    if (t > EPSILON) {
      let normal = math.cross(edge1, edge2);
      return [t, math.divide(normal, Math.sqrt(math.dot(normal,normal))), math.add(origin, math.multiply(direction, t))];
    } else {
      return [Infinity];
    }
  }
}

document.querySelector("button").onclick = function() {
  imgData = ctx.createImageData(WIDTH, HEIGHT);
  const matrix = math.matrix([[0, 1], [2, 3], [4, 5]]);
  let camW = math.subtract(camera.lookAt,camera.lookFrom);
  let camU = math.cross(camW, camera.lookUp);
  let camV = math.cross(camU, camW);
  camU.push(-camera.lookAt[0]);
  camV.push(-camera.lookAt[1]);
  camW.push(-camera.lookAt[2]);
  let transform = math.matrix([camU,camV,camW, [0,0,0,1]]);

  let yScale = Math.tan((Math.PI / 180.0) * camera.fov);
  let xScale = yScale / ASPECT_RATIO;

  for (let y = HEIGHT-1; y >= 0; y--) {
    for (let x = WIDTH-1; x >= 0; x--) {

      let viewportY = -((y/HEIGHT)*2 - 1)*yScale;
      let viewportX = ((x/WIDTH)*2 - 1)*xScale;
      let transformed = math.multiply(transform, [viewportX, viewportY, 0, 1]);
      setTimeout( function () {
      let directionVector = math.subtract(math.subset(transformed, math.index([0,1,2])), camera.lookFrom);
      directionVector = directionVector.map(function(x) { return x / Math.sqrt(math.dot(directionVector,directionVector)) });
      //let color = [0.1,0.1,0.0];
      //if ((x == 0 && y == 240) || (x == 240 && y == 240))
        let color = raytrace(camera.lookFrom, directionVector._data, 0);

      //For every pixel on the screen:
      let pixel = (y*WIDTH*4) + x*4;
      imgData.data[pixel] = color[0]*255;
      imgData.data[pixel+1] = color[1]*255;
      imgData.data[pixel+2] = color[2]*255;
      imgData.data[pixel+3] = 255;
      }, 1);
    }
  }
}
