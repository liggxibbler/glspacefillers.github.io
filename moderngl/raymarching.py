import numpy as np

import moderngl
from example import Example

frag_path = r"shaders\fragment\raymarch.frag"
vert_path = r"shaders\vertex\raymarch.vert"

with open(frag_path) as frag_file:
    shfragment = frag_file.read()

with open(vert_path) as vert_file:
    shvertex = vert_file.read()

class Torus:
    def __init__(self):
        self.center = None
        self.normal = None
        self.radii = None

class Plane:
    def __init__(self):
        self.point = None
        self.normal = None

class Raymarch(Example):
    title = "Space Fillers"
    gl_version = (3, 3)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        self.prog = self.ctx.program(
            vertex_shader=shvertex,
            fragment_shader=shfragment,
        )

        for x in self.prog:
            print (x)

        self.screen_res = self.prog['ScreenRes']
        self.screen_res.value = (.4, .3, .3)

        self.sphere = self.prog['Sphere']
        self.sphere.value = (0, 0, 20, 5)

        self.torus = Torus()
        self.torus.center = self.prog['Torus.center']
        self.torus.center.value = (0, 0, 20)
        self.torus.normal = self.prog['Torus.normal']
        self.torus.normal.value = (0, 0, 1)
        self.torus.radii = self.prog['Torus.radii']
        self.torus.radii.value = (10, 2, 0)

        self.plane = Plane()
        self.plane.point = self.prog['Plane.point']
        self.plane.point.value = (0,-20,0)
        self.plane.normal = self.prog['Plane.normal']
        self.plane.normal.value = (0, 1, 0)

        self.stepinfo = self.prog['StepInfo']
        self.stepinfo.value = (1000, .001, 0, 0)

        self.lightpos = self.prog['LightPos']
        self.lightpos.value = (0, 10, 0)

        vertices = np.array([-1, 1, -1, -1, 1, -1, 1, 1])

        self.vbo = self.ctx.buffer(vertices.astype('f4'))
        self.vao = self.ctx._vertex_array(self.prog, [(self.vbo, "2f", "in_vert")])

        self.camera = self.prog['Camera']
        
        self.camera_rt = (1, 0, 0, 0)
        self.camera_up = (0, 1, 0, 0)
        self.camera_fd = (0, 0, 1, 0)
        self.camera_pos = (0, 0, 0, 1)
        self.update_camera_value()

    def rotate_camera_about_y(self, angle):
        from math import cos, sin, pi        
        self.camera_rt = (cos(angle), 0, sin(angle), 0)
        self.camera_up = (0, 1, 0, 0)
        self.camera_fd = (cos(pi/2 + angle), 0, sin(pi/2 + angle), 0)
        self.update_camera_value()

    def rotate_camera_about_x(self, angle):
        from math import cos, sin, pi
        self.camera_rt = (1, 0, 0, 0)
        self.camera_up = (0, sin(angle + pi /2), cos(angle + pi/2), 0)        
        self.camera_fd = (0, sin(angle), cos(angle), 0)
        self.update_camera_value()

    def rotate_camera_about_z(self, angle):
        from math import cos, sin, pi
        self.camera_rt = (cos(angle), sin(angle), 0, 0)
        self.camera_up = (cos(angle + pi/2), sin(angle + pi /2), 0, 0)
        self.camera_fd = (0, 0, 1, 0)
        self.update_camera_value()

    def update_camera_value(self):
        self.camera.value = (*self.camera_rt, *self.camera_up, *self.camera_fd, *self.camera_pos)

    def render(self, time, frame_time):
        from math import sin, cos, pi

        self.ctx.clear(0.0, 0.0, 0.0)

        rad = 40
        scale = .33
        c = cos(time) * pi/4
        #self.lightpos.value = (cos(time * scale) * rad, 60, 20 + sin(time * scale) * rad)
        self.torus.center.value = (0, 0, 20)
        #self.torus.normal.value = (sin(time), 0, cos(time))
        self.torus.radii.value = (12, 5, 0)
        
        self.sphere.value = (0, 10 * cos(time), 20, 5)
        #self.plane.value = [(0,0,30), (0, -sin(c), -cos(c))]

        self.rotate_camera_about_z(sin(time) * pi/2)
        self.camera_pos = (cos(time / 2), 0, 0, 1)
        self.update_camera_value()

        self.vao.render(moderngl.TRIANGLE_FAN)

        #self.vao.release()
        #self.vbo.release()

if __name__ == '__main__':
    Raymarch.run((1024,768))
