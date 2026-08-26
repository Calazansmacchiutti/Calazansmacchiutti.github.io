/*
	Background particle field.
	Atomic dots drifting over the page background, linked by proximity and
	reacting to the cursor. No dependencies.
*/
(function () {

	'use strict';

	var canvas = document.getElementById('bg-particles');

	if (!canvas || !canvas.getContext)
		return;

	var ctx = canvas.getContext('2d');

	var settings = {

		// One particle per this many CSS pixels of viewport area.
			density: 7200,

		// Hard limits on the particle count.
			maxParticles: 260,
			minParticles: 40,

		// Distance (px) under which two particles get linked.
			linkDistance: 124,

		// Distance (px) under which the cursor links to (and pushes) a particle.
			mouseRadius: 300,

		// How far (px) a particle is pushed away at the centre of the cursor.
			mousePush: 58,

		// Base drift speed (px per frame at 60fps).
			speed: 0.17,

		// Colors, as "r, g, b".
			dot: '226, 238, 241',
			link: '118, 200, 196',
			mouseLink: '78, 205, 196'

	};

	var particles = [],
		width = 0,
		height = 0,
		ratio = 1,
		mouse = { x: -9999, y: -9999, active: false },
		raf = null,
		paused = false,
		BUCKETS = 8,
		buckets = (function () {
			var out = [], i;
			for (i = 0; i < 8; i++) out.push([]);
			return out;
		})(),
		reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Particles.

		function makeParticle() {

			var angle = Math.random() * Math.PI * 2,
				speed = settings.speed * (0.35 + Math.random() * 0.9);

			return {
				x: Math.random() * width,
				y: Math.random() * height,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				r: 1 + Math.random() * 1.6,
				a: 0.45 + Math.random() * 0.5,
				ox: 0,
				oy: 0
			};

		}

		function populate() {

			var target = Math.round((width * height) / settings.density);

			target = Math.max(settings.minParticles, Math.min(settings.maxParticles, target));

			// Shrink or grow in place so a resize doesn't reshuffle the whole field.
				while (particles.length > target)
					particles.pop();

				while (particles.length < target)
					particles.push(makeParticle());

		}

	// Sizing.

		function resize() {

			var parent = canvas.parentNode;

			width = parent.clientWidth || window.innerWidth;
			height = parent.clientHeight || window.innerHeight;
			ratio = Math.min(window.devicePixelRatio || 1, 2);

			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			canvas.style.width = width + 'px';
			canvas.style.height = height + 'px';

			ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

			populate();

			if (reduced)
				draw();

		}

	// Frame.

		function step() {

			var i, p, dx, dy, d, force, tx, ty,
				radius = settings.mouseRadius,
				radiusSq = radius * radius,
				margin = 40;

			for (i = 0; i < particles.length; i++) {

				p = particles[i];

				p.x += p.vx;
				p.y += p.vy;

				// Wrap around the edges.
					if (p.x < -margin) p.x = width + margin;
					else if (p.x > width + margin) p.x = -margin;

					if (p.y < -margin) p.y = height + margin;
					else if (p.y > height + margin) p.y = -margin;

				// Push away from the cursor, easing back to rest when it leaves.
					tx = 0;
					ty = 0;

					if (mouse.active) {

						dx = p.x - mouse.x;
						dy = p.y - mouse.y;
						d = dx * dx + dy * dy;

						if (d < radiusSq && d > 0.01) {
							d = Math.sqrt(d);
							force = (1 - (d / radius)) * settings.mousePush;
							tx = (dx / d) * force;
							ty = (dy / d) * force;
						}

					}

					p.ox += (tx - p.ox) * (tx || ty ? 0.14 : 0.06);
					p.oy += (ty - p.oy) * (tx || ty ? 0.14 : 0.06);

			}

		}

		function draw() {

			var i, j, a, b, dx, dy, d, t, bucket,
				link = settings.linkDistance,
				linkSq = link * link,
				radius = settings.mouseRadius,
				radiusSq = radius * radius,
				ax, ay, bx, by;

			ctx.clearRect(0, 0, width, height);

			// Links between particles. Segments are bucketed by opacity so the
			// whole mesh goes out in a handful of strokes instead of one per line.
				for (i = 0; i < BUCKETS; i++)
					buckets[i].length = 0;

				for (i = 0; i < particles.length; i++) {

					a = particles[i];
					ax = a.x + a.ox;
					ay = a.y + a.oy;

					for (j = i + 1; j < particles.length; j++) {

						b = particles[j];
						bx = b.x + b.ox;
						by = b.y + b.oy;

						dx = ax - bx;
						dy = ay - by;
						d = dx * dx + dy * dy;

						if (d < linkSq) {
							t = 1 - (Math.sqrt(d) / link);
							bucket = buckets[Math.min(BUCKETS - 1, (t * BUCKETS) | 0)];
							bucket.push(ax, ay, bx, by);
						}

					}

				}

				ctx.lineWidth = 1;

				for (i = 0; i < BUCKETS; i++) {

					bucket = buckets[i];

					if (!bucket.length)
						continue;

					ctx.strokeStyle = 'rgba(' + settings.link + ',' + (0.32 * ((i + 0.5) / BUCKETS)).toFixed(3) + ')';
					ctx.beginPath();

					for (j = 0; j < bucket.length; j += 4) {
						ctx.moveTo(bucket[j], bucket[j + 1]);
						ctx.lineTo(bucket[j + 2], bucket[j + 3]);
					}

					ctx.stroke();

				}

			// Links to the cursor, bucketed the same way.
				if (mouse.active) {

					for (i = 0; i < BUCKETS; i++)
						buckets[i].length = 0;

					for (i = 0; i < particles.length; i++) {

						a = particles[i];
						ax = a.x + a.ox;
						ay = a.y + a.oy;

						dx = ax - mouse.x;
						dy = ay - mouse.y;
						d = dx * dx + dy * dy;

						if (d < radiusSq) {
							t = 1 - (Math.sqrt(d) / radius);
							bucket = buckets[Math.min(BUCKETS - 1, (t * BUCKETS) | 0)];
							bucket.push(ax, ay, mouse.x, mouse.y);
						}

					}

					for (i = 0; i < BUCKETS; i++) {

						bucket = buckets[i];

						if (!bucket.length)
							continue;

						ctx.strokeStyle = 'rgba(' + settings.mouseLink + ',' + (0.55 * ((i + 0.5) / BUCKETS)).toFixed(3) + ')';
						ctx.beginPath();

						for (j = 0; j < bucket.length; j += 4) {
							ctx.moveTo(bucket[j], bucket[j + 1]);
							ctx.lineTo(bucket[j + 2], bucket[j + 3]);
						}

						ctx.stroke();

					}

				}

			// Dots.
				for (i = 0; i < particles.length; i++) {

					a = particles[i];

					ctx.fillStyle = 'rgba(' + settings.dot + ',' + a.a + ')';
					ctx.beginPath();
					ctx.arc(a.x + a.ox, a.y + a.oy, a.r, 0, Math.PI * 2);
					ctx.fill();

				}

		}

		function loop() {

			step();
			draw();
			raf = window.requestAnimationFrame(loop);

		}

		function start() {

			if (raf !== null || paused || reduced)
				return;

			raf = window.requestAnimationFrame(loop);

		}

		function stop() {

			if (raf === null)
				return;

			window.cancelAnimationFrame(raf);
			raf = null;

		}

	// Events.

		window.addEventListener('resize', (function () {

			var timer = null;

			return function () {
				clearTimeout(timer);
				timer = setTimeout(resize, 150);
			};

		})());

		if (!reduced) {

			window.addEventListener('mousemove', function (event) {
				mouse.x = event.clientX;
				mouse.y = event.clientY;
				mouse.active = true;
			}, { passive: true });

			window.addEventListener('mouseout', function (event) {
				if (!event.relatedTarget)
					mouse.active = false;
			});

			window.addEventListener('touchmove', function (event) {
				var touch = event.touches[0];
				if (touch) {
					mouse.x = touch.clientX;
					mouse.y = touch.clientY;
					mouse.active = true;
				}
			}, { passive: true });

			window.addEventListener('touchend', function () {
				mouse.active = false;
			});

		}

		document.addEventListener('visibilitychange', function () {

			if (document.hidden)
				stop();
			else
				start();

		});

	// Go.

		resize();
		start();

	// Small public handle, so the animation can be paused from elsewhere.

		window.BgParticles = {

			pause: function () {
				paused = true;
				stop();
			},

			resume: function () {
				paused = false;
				start();
			},

			toggle: function () {
				if (paused)
					this.resume();
				else
					this.pause();

				return !paused;
			},

			isPaused: function () {
				return paused || reduced;
			}

		};

})();
