import gpgpuRaw from './gpgpu.glsl?raw';
import simplex from '../includes/simplexNoise4D.glsl?raw';

// Simple one-off include replacer for this shader
const gpgpu = gpgpuRaw.replace('#include ../includes/simplexNoise4D.glsl', simplex);

export default gpgpu;

