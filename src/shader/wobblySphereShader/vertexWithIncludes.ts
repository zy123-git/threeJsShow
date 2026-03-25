import vertexRaw from './vertex.glsl?raw';
import simplex4 from '../../shader/includes/simplexNoise4D.glsl?raw';

// Expand include for this vertex shader and normalize numeric literals where needed
let shader = vertexRaw.replace('#include ../includes/simplexNoise4D.glsl', simplex4);
// ensure integer literal multipliers are floats to avoid GLSL strictness
shader = shader.replace(/\*\s*3\b/g, '* 3.0');

export default shader;

