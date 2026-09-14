import type { Course } from '@/lib/courses';
import { t } from '@/lib/i18n';
import { toWorld, routeAt } from '@/lib/routes';
import { ribbonFootprint } from '@/lib/ribbon';

export default function RouteMap({ course }: { course: Course }) {
  const corners = course.platforms.map((p) =>
    [
      [-p.w / 2, -p.d / 2],
      [p.w / 2, -p.d / 2],
      [p.w / 2, p.d / 2],
      [-p.w / 2, p.d / 2],
    ].map(([x, z]) => toWorld(p, x, z)),
  );
  const points = corners.flat(),
    minX = Math.min(...points.map((p) => p.x)) - 7,
    maxX = Math.max(...points.map((p) => p.x)) + 7;
  const minZ = Math.min(...points.map((p) => p.z)) - 7,
    maxZ = Math.max(...points.map((p) => p.z)) + 7;
  const finish = routeAt(course, course.length);
  return (
    <svg
      className="course-map"
      viewBox={`${minX} ${-maxZ} ${maxX - minX} ${maxZ - minZ}`}
      aria-label={t(`Overhead route map of ${course.name}`)}
    >
      <title>{course.name}: {t('turns, forks, platforms and hazards')}</title>
      {corners.map((ps, i) =>
        course.platforms[i].ribbon !== undefined ? null : (
          <polygon
            key={i}
            points={ps.map((p) => `${p.x},${-p.z}`).join(' ')}
            fill={
              course.platforms[i].kind === 'crumble'
                ? course.accent
                : course.color
            }
            stroke="#8dbced"
            strokeWidth=".3"
          />
        ),
      )}
      {(course.ribbons ?? []).map((ribbon, i) => (
        <polygon
          key={`ribbon-${i}`}
          points={ribbonFootprint(ribbon)
            .map((p) => `${p.x},${-p.z}`)
            .join(' ')}
          fill={course.color}
          stroke="#8dbced"
          strokeWidth=".3"
        />
      ))}
      {course.obstacles.map((o, i) => (
        <circle
          key={i}
          cx={o.x}
          cy={-o.z}
          r={o.type === 'bar' ? 2 : 1.3}
          fill={course.accent}
        />
      ))}
      <circle cx="0" cy="-1" r="3" fill="#fff" />
      <circle cx={finish.x} cy={-finish.z} r="3.6" fill="#ffe16b" />
    </svg>
  );
}
