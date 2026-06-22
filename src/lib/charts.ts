// Register only the Chart.js pieces we use, to keep the single-file bundle small.
import {
  Chart, CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend, BarController, DoughnutController,
} from 'chart.js';

Chart.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip, Legend, BarController, DoughnutController,
);

export { Chart };
