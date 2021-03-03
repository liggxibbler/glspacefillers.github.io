#version 330

#define CAMERA_POS CameraFrag[3].xyz
#define MAX_STEP StepInfo.x
#define MIN_DIST StepInfo.y
#define SMIN_K 1
#define PI 3.14159265

struct TorusStruct
{
    vec3 center;
    vec3 normal;
    vec3 radii;
};

uniform mat4x4 CameraFrag;
uniform vec4 Plane;
uniform TorusStruct Torus;
uniform vec4 Sphere;
uniform vec4 StepInfo;
uniform vec3 LightPos;

uniform int Iterations;
uniform int Bailout;
uniform float Power;

in vec3 v_pixray;
out vec4 f_color;

float smin(float a, float b, float k)
{    
    float h = clamp(0.5 + 0.5 * (a - b) / k, 0.0, 1.0);
    return mix(a, b, h) - k * h * (1.0 - h);
}

float distance_to_torus(vec3 p)
{
    vec3 g = dot(p - Torus.center, Torus.normal) * Torus.normal;
    vec3 pp = p - g;
    vec3 m = Torus.center + normalize(pp - Torus.center) * Torus.radii.x;
    return length((p - m)) - Torus.radii.y;
}

float sdCone( in vec3 p, in vec2 c, float h )
{
  // c is the sin/cos of the angle, h is height
  // Alternatively pass q instead of (c,h),
  // which is the point at the base in 2D
  vec2 q = h*vec2(c.x/c.y,-1.0);
    
  vec2 w = vec2( length(p.xz), p.y );
  vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
  vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
  float k = sign( q.y );
  float d = min(dot( a, a ),dot(b, b));
  float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
  return sqrt(d)*sign(s);
}

float distance_to_sphere(vec3 point, float r)
{
    return length(point) - r;
}

float distance_to_plane(vec3 point, vec4 plane)
{
    vec3 plane_intersect = vec3(0, plane.w, 0);
    return dot (point - plane_intersect, plane.xyz);
}

float distance_to_box(vec3 point, vec3 side)
{
    vec3 center = vec3(0);    
    vec3 q = abs(point - center) - side;
    float dist =  length(max(q, 0));
    return dist + min(max(q.x,max(q.y,q.z)),0.0);
}

float DE(vec3 pos) {
	vec3 z = pos;
	float dr = 1.0;
	float r = 0.0;
	for (int i = 0; i < Iterations ; i++)
    {
		r = length(z);
		if (r>Bailout) break;
		
		// convert to polar coordinates
		float theta = acos(z.z/r);
		float phi = atan(z.y,z.x);
		dr =  pow( r, Power-1.0)*Power*dr + 1.0;
		
		// scale and rotate the point
		float zr = pow( r,Power);
		theta = theta*Power;
		phi = phi*Power;
		
		// convert back to cartesian coordinates
		z = zr*vec3(sin(theta)*cos(phi), sin(phi)*sin(theta), cos(theta));
		z+=pos;
	}
	return 0.5*log(r)*r/dr;
}

float distance(vec3 point)
{
    float factor = 30;
    vec3 pos = mod(point, factor * 2) - factor;
    float dist = smin(distance_to_sphere(pos - Sphere.xyz, Sphere.w), distance_to_plane(pos, Plane), SMIN_K);
    dist = smin(dist, distance_to_torus(pos), SMIN_K);
    //dist = max(-dist, distance_to_torus(pos));
    //return min(distance_to_box(pos, vec3(15, 15, 15)), distance_to_plane(point, Plane)) + (dist-dist);
    float toCone = sdCone(point, vec2(sin(PI/6),cos(PI/6)), 2) + (dist - dist);
    float toSphere = distance_to_sphere(point - vec3(-1.15/2, -2.1, 0), 1.15/2);
    float toPlane = distance_to_plane(point, vec4(0, -1, 0, -2.1));
    float hemisphere = max(toSphere, -toPlane);
    return DE(point) + toCone - toCone + hemisphere - hemisphere;
}

float raymarch(vec3 pos, vec3 ray)
{
    float step = 0;
    float dist = MAX_STEP;
    
    while (step < MAX_STEP && dist > MIN_DIST)
    {
        dist = distance(pos + ray * step);
        step = step + dist;
    }

    return step;
}

vec3 GetNormal(vec3 hit)
{
    vec2 e = vec2(.01, 0);

    vec3 d1 = vec3(
        distance(hit + e.xyy),
        distance(hit + e.yxy),
        distance(hit + e.yyx)
    );

    vec3 d2 = vec3(
        distance(hit - e.xyy),
        distance(hit - e.yxy),
        distance(hit - e.yyx)
    );

    return normalize(d1 - d2);
}

float softshadow(vec3 hit, vec3 hitLightDir, float distToLight, float k)
{
    float step = 0;
    float dist = MAX_STEP;
    
    float ph = 1e20;

    float res = 1.0;

    while (step < distToLight && dist > MIN_DIST)
    {
        dist = distance(hit + hitLightDir * step);
        if (dist < MIN_DIST)
            return 0.0;
        float y = dist * dist / (2.0 * ph);
        float d = sqrt(dist*dist - y*y);
        res = min(res, k * d / max(0.0, step -y));
        ph = dist;
        step = step + dist;
    }

    return res;
}

float shadow(vec3 hit, vec3 hitLightDir, float distToLight)
{
    float step = 0;
    float dist = MAX_STEP;
    float res = 1.0f;
    while (step < distToLight && dist > MIN_DIST)
    {
        dist = distance(hit + hitLightDir * step);
        if (dist < MIN_DIST)
            return 0.0;
        step = step + dist;
    }
    return res;
}

void main()
{
    vec3 ray = normalize(v_pixray - CAMERA_POS);

    float step = raymarch(CAMERA_POS, ray);

    if (step < MAX_STEP)
    {
        vec3 hit = CAMERA_POS + ray * step;
        vec3 hitToLight = LightPos - hit;
        vec3 hitLightDir = normalize(hitToLight);
        vec3 normal = GetNormal(hit);
        //float shadow = softshadow(hit + MIN_DIST * normal, hitLightDir, length(hitToLight), 10);
        float shadow = shadow(hit + 2 * MIN_DIST * normal, hitLightDir, length(hitToLight));
        
        float diffuse = clamp(dot(hitLightDir, normal), 0, 1);
        vec3 reflect = normalize(2 * dot(hitLightDir, normal) * normal - hitLightDir);
        float specular = clamp(dot(-ray, reflect), 0, 1);
        float shade = diffuse + pow(specular, 7);
        
        //f_color = vec4(shade*hitLightDir, 1);        
        //f_color = vec4(vec3(shade * 60), 1);
        f_color = vec4(vec3(shadow * shade), 1);
        //f_color = vec4(abs(normal), 1);
    }
    else
        f_color = vec4(0,Plane.x,Plane.x,Plane.z);
}