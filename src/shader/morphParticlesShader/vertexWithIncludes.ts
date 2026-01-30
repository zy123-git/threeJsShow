import vertexRaw from './vertex.glsl?raw';
import simplex from '../includes/simplexNoise3D.glsl?raw';

// Replace simple #include directive with the included source.
// This is a lightweight workaround because some GLSL loaders do not preprocess #include.
const vertex = vertexRaw.replace('#include ../includes/simplexNoise3D.glsl', simplex);

export default vertex;

