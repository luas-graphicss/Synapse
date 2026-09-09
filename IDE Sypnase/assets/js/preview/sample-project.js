(function (root) {
    'use strict';

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Meridian · Revenue operations</title>
		<link rel="stylesheet" href="styles/tokens.css" />
		<link rel="stylesheet" href="styles/app.css" />
	</head>
	<body>
		<header class="app-bar">
			<div class="brand">
				<span class="brand-mark">M</span>
				<span class="brand-name">Meridian</span>
				<span class="brand-section">Revenue operations</span>
			</div>
			<div class="app-bar-actions">
				<div class="range-switch" role="group" aria-label="Reporting range">
					<button type="button" class="range-option" data-range="quarter">Quarter</button>
					<button type="button" class="range-option is-selected" data-range="half">Half year</button>
					<button type="button" class="range-option" data-range="year">Full year</button>
				</div>
				<button type="button" class="ghost-button" id="exportButton">Export CSV</button>
			</div>
		</header>

		<main class="content">
			<section class="metric-grid" id="metricGrid" aria-label="Key metrics"></section>

			<section class="panel">
				<div class="panel-head">
					<div>
						<h2 class="panel-title">Recurring revenue</h2>
						<p class="panel-hint">Closed revenue against the committed target</p>
					</div>
					<div class="legend">
						<span class="legend-item"><i class="legend-swatch"></i>Revenue</span>
						<span class="legend-item"><i class="legend-swatch is-target"></i>Target</span>
					</div>
				</div>
				<div class="chart-frame" id="chartFrame"></div>
			</section>

			<section class="panel">
				<div class="panel-head">
					<div>
						<h2 class="panel-title">Accounts</h2>
						<p class="panel-hint">Contribution in the selected range</p>
					</div>
					<input
						class="filter-input"
						id="accountFilter"
						type="search"
						placeholder="Filter accounts"
						aria-label="Filter accounts"
					/>
				</div>
				<table class="data-table">
					<thead>
						<tr>
							<th><button type="button" class="sort-button" data-column="name">Account</button></th>
							<th><button type="button" class="sort-button" data-column="plan">Plan</button></th>
							<th class="is-numeric"><button type="button" class="sort-button" data-column="revenue">Revenue</button></th>
							<th class="is-numeric"><button type="button" class="sort-button" data-column="growth">Growth</button></th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody id="accountRows"></tbody>
				</table>
				<p class="table-empty" id="tableEmpty" hidden>No account matches this filter.</p>
			</section>
		</main>

		<script src="scripts/format.js"></script>
		<script src="scripts/data.js"></script>
		<script src="scripts/chart.js"></script>
		<script src="scripts/app.js"></script>
	</body>
</html>
`;

    const tokensCss = `:root {
	color-scheme: dark;
	--surface-base: #0f1116;
	--surface-raised: #161922;
	--surface-hover: #1d212c;
	--border-subtle: #232838;
	--border-strong: #303752;
	--text-primary: #e8ebf2;
	--text-secondary: #9aa3b8;
	--text-muted: #6b7488;
	--accent: #5b8cff;
	--accent-soft: rgba(91, 140, 255, 0.16);
	--positive: #3ecf8e;
	--warning: #e6c15c;
	--negative: #f2698a;
	--radius-small: 6px;
	--radius-medium: 10px;
	--space-tight: 8px;
	--space-base: 16px;
	--space-loose: 24px;
	--font-sans: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
	--font-mono: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
	--shadow-panel: 0 1px 2px rgba(5, 7, 12, 0.6);
}
`;

    const appCss = `* {
	box-sizing: border-box;
}

body {
	margin: 0;
	background: var(--surface-base);
	color: var(--text-primary);
	font-family: var(--font-sans);
	font-size: 14px;
	line-height: 1.5;
}

.app-bar {
	position: sticky;
	top: 0;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-base);
	padding: 14px var(--space-loose);
	background: var(--surface-raised);
	border-bottom: 1px solid var(--border-subtle);
}

.brand {
	display: flex;
	align-items: center;
	gap: 10px;
}

.brand-mark {
	display: grid;
	place-items: center;
	width: 26px;
	height: 26px;
	border-radius: var(--radius-small);
	background: var(--accent);
	color: #0b1020;
	font-size: 13px;
	font-weight: 700;
}

.brand-name {
	font-weight: 600;
}

.brand-section {
	padding-left: 10px;
	border-left: 1px solid var(--border-subtle);
	color: var(--text-secondary);
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.app-bar-actions {
	display: flex;
	align-items: center;
	gap: 10px;
}

.range-switch {
	display: flex;
	gap: 2px;
	padding: 2px;
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-small);
	background: var(--surface-base);
}

.range-option {
	padding: 5px 10px;
	border: 0;
	border-radius: 4px;
	background: transparent;
	color: var(--text-secondary);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}

.range-option:hover {
	color: var(--text-primary);
}

.range-option.is-selected {
	background: var(--accent-soft);
	color: var(--text-primary);
}

.ghost-button {
	padding: 6px 12px;
	border: 1px solid var(--border-strong);
	border-radius: var(--radius-small);
	background: transparent;
	color: var(--text-primary);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}

.ghost-button:hover {
	background: var(--surface-hover);
}

.content {
	display: grid;
	gap: var(--space-loose);
	max-width: 1120px;
	margin: 0 auto;
	padding: var(--space-loose);
}

.metric-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: var(--space-base);
}

.metric-card {
	padding: var(--space-base);
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-medium);
	background: var(--surface-raised);
	box-shadow: var(--shadow-panel);
}

.metric-label {
	margin: 0;
	color: var(--text-secondary);
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.metric-value {
	margin: 8px 0 4px;
	font-family: var(--font-mono);
	font-size: 24px;
	font-variant-numeric: tabular-nums;
}

.metric-note {
	margin: 0;
	color: var(--text-muted);
	font-size: 12px;
}

.metric-note[data-trend='positive'] {
	color: var(--positive);
}

.metric-note[data-trend='negative'] {
	color: var(--negative);
}

.panel {
	border: 1px solid var(--border-subtle);
	border-radius: var(--radius-medium);
	background: var(--surface-raised);
	box-shadow: var(--shadow-panel);
}

.panel-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--space-base);
	padding: var(--space-base);
	border-bottom: 1px solid var(--border-subtle);
}

.panel-title {
	margin: 0;
	font-size: 15px;
	font-weight: 600;
}

.panel-hint {
	margin: 4px 0 0;
	color: var(--text-secondary);
	font-size: 12px;
}

.legend {
	display: flex;
	gap: 14px;
	color: var(--text-secondary);
	font-size: 12px;
}

.legend-item {
	display: flex;
	align-items: center;
	gap: 6px;
}

.legend-swatch {
	width: 10px;
	height: 10px;
	border-radius: 2px;
	background: var(--accent);
}

.legend-swatch.is-target {
	height: 0;
	border-radius: 0;
	border-top: 2px dashed var(--text-muted);
	background: transparent;
}

.chart-frame {
	padding: var(--space-base);
}

.revenue-chart {
	display: block;
	width: 100%;
	height: auto;
}

.chart-grid-line {
	stroke: var(--border-subtle);
	stroke-width: 1;
}

.chart-axis-label {
	fill: var(--text-muted);
	font-family: var(--font-mono);
	font-size: 10px;
}

.chart-bar {
	fill: rgba(91, 140, 255, 0.5);
}

.chart-bar.is-above {
	fill: var(--accent);
}

.chart-target-line {
	fill: none;
	stroke: var(--text-muted);
	stroke-width: 1.5;
	stroke-dasharray: 5 4;
}

.data-table {
	width: 100%;
	border-collapse: collapse;
}

.data-table th,
.data-table td {
	padding: 10px var(--space-base);
	border-bottom: 1px solid var(--border-subtle);
	text-align: left;
}

.data-table th {
	color: var(--text-secondary);
	font-size: 11px;
	font-weight: 600;
	letter-spacing: 0.08em;
	text-transform: uppercase;
}

.data-table tbody tr:hover {
	background: var(--surface-hover);
}

.data-table .is-numeric {
	text-align: right;
	font-family: var(--font-mono);
	font-variant-numeric: tabular-nums;
}

.sort-button {
	padding: 0;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	letter-spacing: inherit;
	text-transform: inherit;
	cursor: pointer;
}

.sort-button[data-active='true'] {
	color: var(--text-primary);
}

.sort-button[data-active='true']::after {
	content: '↓';
	margin-left: 6px;
}

.sort-button[data-active='true'][data-direction='ascending']::after {
	content: '↑';
}

.account-name {
	font-weight: 600;
}

.account-plan {
	color: var(--text-secondary);
}

.is-positive {
	color: var(--positive);
}

.is-negative {
	color: var(--negative);
}

.status-badge {
	display: inline-flex;
	align-items: center;
	padding: 3px 8px;
	border: 1px solid var(--border-strong);
	border-radius: 999px;
	color: var(--text-secondary);
	font-size: 11px;
}

.status-badge[data-status='Healthy'] {
	border-color: rgba(62, 207, 142, 0.35);
	color: var(--positive);
}

.status-badge[data-status='Watch'] {
	border-color: rgba(230, 193, 92, 0.35);
	color: var(--warning);
}

.status-badge[data-status='At risk'] {
	border-color: rgba(242, 105, 138, 0.35);
	color: var(--negative);
}

.filter-input {
	width: 200px;
	padding: 6px 10px;
	border: 1px solid var(--border-strong);
	border-radius: var(--radius-small);
	background: var(--surface-base);
	color: var(--text-primary);
	font: inherit;
	font-size: 12px;
}

.filter-input:focus-visible,
.sort-button:focus-visible,
.range-option:focus-visible,
.ghost-button:focus-visible {
	outline: 2px solid var(--accent);
	outline-offset: 2px;
}

.table-empty {
	margin: 0;
	padding: var(--space-base);
	color: var(--text-muted);
	font-size: 12px;
}

@media (max-width: 720px) {
	.app-bar {
		flex-direction: column;
		align-items: flex-start;
	}

	.brand-section {
		display: none;
	}

	.content {
		padding: var(--space-base);
	}

	.panel-head {
		flex-direction: column;
	}

	.filter-input {
		width: 100%;
	}
}
`;

    const formatScript = `const currencyFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat('en-US', {
	style: 'percent',
	maximumFractionDigits: 1,
});

function formatCurrency(amount) {
	return currencyFormatter.format(amount);
}

function formatCompactCurrency(amount) {
	return '$' + compactFormatter.format(amount);
}

function formatPercent(ratio) {
	return percentFormatter.format(ratio);
}

function formatSignedPercent(ratio) {
	return (ratio > 0 ? '+' : '') + percentFormatter.format(ratio);
}
`;

    const dataScript = `const monthlyPerformance = [
	{ month: 'Jan', revenue: 386000, target: 400000 },
	{ month: 'Feb', revenue: 412500, target: 405000 },
	{ month: 'Mar', revenue: 398200, target: 410000 },
	{ month: 'Apr', revenue: 441800, target: 415000 },
	{ month: 'May', revenue: 468300, target: 430000 },
	{ month: 'Jun', revenue: 455100, target: 445000 },
	{ month: 'Jul', revenue: 489700, target: 460000 },
	{ month: 'Aug', revenue: 512400, target: 475000 },
	{ month: 'Sep', revenue: 498900, target: 490000 },
	{ month: 'Oct', revenue: 536200, target: 505000 },
	{ month: 'Nov', revenue: 574800, target: 520000 },
	{ month: 'Dec', revenue: 601300, target: 540000 },
];

const accounts = [
	{ name: 'Halden Logistics', plan: 'Enterprise', revenue: 184500, growth: 0.14, status: 'Healthy' },
	{ name: 'Verity Health', plan: 'Enterprise', revenue: 162300, growth: 0.09, status: 'Healthy' },
	{ name: 'Ridley Manufacturing', plan: 'Enterprise', revenue: 143900, growth: 0.21, status: 'Healthy' },
	{ name: 'Sundial Energy', plan: 'Enterprise', revenue: 129700, growth: 0.05, status: 'Watch' },
	{ name: 'Northgate Foods', plan: 'Growth', revenue: 98400, growth: -0.03, status: 'Watch' },
	{ name: 'Marrow Financial', plan: 'Growth', revenue: 88600, growth: 0.17, status: 'Healthy' },
	{ name: 'Bramble Retail', plan: 'Growth', revenue: 76200, growth: -0.11, status: 'At risk' },
	{ name: 'Cobalt Studios', plan: 'Team', revenue: 41800, growth: 0.32, status: 'Healthy' },
	{ name: 'Pinehurst Travel', plan: 'Team', revenue: 33400, growth: -0.08, status: 'At risk' },
];

const reportingRanges = {
	quarter: { label: 'Quarter', months: 3 },
	half: { label: 'Half year', months: 6 },
	year: { label: 'Full year', months: 12 },
};
`;

    const chartScript = `const svgNamespace = 'http://www.w3.org/2000/svg';

function createSvgElement(tagName, attributes) {
	const element = document.createElementNS(svgNamespace, tagName);
	for (const name of Object.keys(attributes)) element.setAttribute(name, String(attributes[name]));
	return element;
}

function createSvgText(attributes, content) {
	const element = createSvgElement('text', attributes);
	element.textContent = content;
	return element;
}

function renderRevenueChart(container, series) {
	const width = 720;
	const height = 260;
	const paddingLeft = 58;
	const paddingRight = 18;
	const paddingTop = 18;
	const paddingBottom = 34;
	const plotWidth = width - paddingLeft - paddingRight;
	const plotHeight = height - paddingTop - paddingBottom;
	const highestValue = series.reduce(
		(highest, point) => Math.max(highest, point.revenue, point.target),
		0,
	);
	const scaleTop = Math.max(100000, Math.ceil(highestValue / 100000) * 100000);
	const gridLineCount = 4;
	const chart = createSvgElement('svg', {
		viewBox: '0 0 ' + width + ' ' + height,
		class: 'revenue-chart',
		role: 'img',
		'aria-label': 'Monthly revenue compared with target',
	});

	for (let index = 0; index <= gridLineCount; index++) {
		const gridValue = (scaleTop / gridLineCount) * index;
		const gridY = paddingTop + plotHeight - (plotHeight / gridLineCount) * index;
		chart.appendChild(
			createSvgElement('line', {
				x1: paddingLeft,
				y1: gridY,
				x2: width - paddingRight,
				y2: gridY,
				class: 'chart-grid-line',
			}),
		);
		chart.appendChild(
			createSvgText(
				{
					x: paddingLeft - 10,
					y: gridY + 4,
					class: 'chart-axis-label',
					'text-anchor': 'end',
				},
				formatCompactCurrency(gridValue),
			),
		);
	}

	const slotWidth = plotWidth / series.length;
	const barWidth = Math.min(28, slotWidth * 0.52);
	const targetPoints = [];

	series.forEach((point, index) => {
		const center = paddingLeft + slotWidth * index + slotWidth / 2;
		const barHeight = Math.max(2, (point.revenue / scaleTop) * plotHeight);
		const targetY = paddingTop + plotHeight - (point.target / scaleTop) * plotHeight;
		chart.appendChild(
			createSvgElement('rect', {
				x: center - barWidth / 2,
				y: paddingTop + plotHeight - barHeight,
				width: barWidth,
				height: barHeight,
				rx: 3,
				class: point.revenue >= point.target ? 'chart-bar is-above' : 'chart-bar',
			}),
		);
		targetPoints.push(center + ',' + targetY);
		chart.appendChild(
			createSvgText(
				{ x: center, y: height - 12, class: 'chart-axis-label', 'text-anchor': 'middle' },
				point.month,
			),
		);
	});

	chart.appendChild(
		createSvgElement('polyline', {
			points: targetPoints.join(' '),
			class: 'chart-target-line',
		}),
	);
	container.replaceChildren(chart);
}
`;

    const appScript = `const rangeOptions = Array.from(document.querySelectorAll('.range-option'));
const sortButtons = Array.from(document.querySelectorAll('.sort-button'));
const metricGrid = document.getElementById('metricGrid');
const chartFrame = document.getElementById('chartFrame');
const accountRows = document.getElementById('accountRows');
const accountFilter = document.getElementById('accountFilter');
const tableEmpty = document.getElementById('tableEmpty');
const exportButton = document.getElementById('exportButton');

const dashboardState = {
	range: 'half',
	sortColumn: 'revenue',
	sortDescending: true,
	filterTerm: '',
};

function monthsInRange() {
	return monthlyPerformance.slice(-reportingRanges[dashboardState.range].months);
}

function sumField(items, field) {
	return items.reduce((total, item) => total + item[field], 0);
}

function buildMetrics() {
	const months = monthsInRange();
	const previousMonths = monthlyPerformance.slice(-months.length * 2, -months.length);
	const revenue = sumField(months, 'revenue');
	const target = sumField(months, 'target');
	const previousRevenue = sumField(previousMonths, 'revenue');
	const revenueChange = previousRevenue > 0 ? revenue / previousRevenue - 1 : 0;
	const attainment = target > 0 ? revenue / target : 0;
	const averageGrowth = sumField(accounts, 'growth') / accounts.length;
	const accountsAtRisk = accounts.filter((account) => account.status === 'At risk').length;
	return [
		{
			label: 'Net revenue',
			value: formatCurrency(revenue),
			note: previousMonths.length
				? formatSignedPercent(revenueChange) + ' vs previous period'
				: 'No comparable period',
			trend: revenueChange >= 0 ? 'positive' : 'negative',
		},
		{
			label: 'Target attainment',
			value: formatPercent(attainment),
			note: formatCurrency(target) + ' committed',
			trend: attainment >= 1 ? 'positive' : 'negative',
		},
		{
			label: 'Net expansion',
			value: formatSignedPercent(averageGrowth),
			note: 'Average across ' + accounts.length + ' accounts',
			trend: averageGrowth >= 0 ? 'positive' : 'negative',
		},
		{
			label: 'Accounts at risk',
			value: String(accountsAtRisk),
			note: accountsAtRisk === 0 ? 'Every account is stable' : 'Owners notified this week',
			trend: accountsAtRisk === 0 ? 'positive' : 'negative',
		},
	];
}

function createMetricCard(metric) {
	const card = document.createElement('article');
	card.className = 'metric-card';
	const label = document.createElement('p');
	label.className = 'metric-label';
	label.textContent = metric.label;
	const value = document.createElement('p');
	value.className = 'metric-value';
	value.textContent = metric.value;
	const note = document.createElement('p');
	note.className = 'metric-note';
	note.dataset.trend = metric.trend;
	note.textContent = metric.note;
	card.append(label, value, note);
	return card;
}

function visibleAccounts() {
	const term = dashboardState.filterTerm.trim().toLowerCase();
	const matches = accounts.filter((account) =>
		(account.name + ' ' + account.plan + ' ' + account.status).toLowerCase().includes(term),
	);
	const direction = dashboardState.sortDescending ? -1 : 1;
	return matches.slice().sort((first, second) => {
		const firstValue = first[dashboardState.sortColumn];
		const secondValue = second[dashboardState.sortColumn];
		if (typeof firstValue === 'number' && typeof secondValue === 'number')
			return (firstValue - secondValue) * direction;
		return String(firstValue).localeCompare(String(secondValue)) * direction;
	});
}

function createTextCell(content, className) {
	const cell = document.createElement('td');
	if (className) cell.className = className;
	cell.textContent = content;
	return cell;
}

function createStatusCell(status) {
	const cell = document.createElement('td');
	const badge = document.createElement('span');
	badge.className = 'status-badge';
	badge.dataset.status = status;
	badge.textContent = status;
	cell.appendChild(badge);
	return cell;
}

function createAccountRow(account) {
	const row = document.createElement('tr');
	row.append(
		createTextCell(account.name, 'account-name'),
		createTextCell(account.plan, 'account-plan'),
		createTextCell(formatCurrency(account.revenue), 'is-numeric'),
		createTextCell(
			formatSignedPercent(account.growth),
			account.growth >= 0 ? 'is-numeric is-positive' : 'is-numeric is-negative',
		),
		createStatusCell(account.status),
	);
	return row;
}

function renderMetrics() {
	metricGrid.replaceChildren(...buildMetrics().map(createMetricCard));
}

function renderChart() {
	renderRevenueChart(chartFrame, monthsInRange());
}

function renderAccounts() {
	const rows = visibleAccounts();
	accountRows.replaceChildren(...rows.map(createAccountRow));
	tableEmpty.hidden = rows.length > 0;
	for (const button of sortButtons) {
		const isActive = button.dataset.column === dashboardState.sortColumn;
		button.dataset.active = String(isActive);
		button.dataset.direction =
			isActive && dashboardState.sortDescending ? 'descending' : 'ascending';
	}
}

function renderDashboard() {
	renderMetrics();
	renderChart();
	renderAccounts();
}

function selectRange(range) {
	dashboardState.range = range;
	for (const option of rangeOptions)
		option.classList.toggle('is-selected', option.dataset.range === range);
	renderMetrics();
	renderChart();
}

function selectSortColumn(column) {
	if (dashboardState.sortColumn === column) {
		dashboardState.sortDescending = !dashboardState.sortDescending;
	} else {
		dashboardState.sortColumn = column;
		dashboardState.sortDescending = column === 'revenue' || column === 'growth';
	}
	renderAccounts();
}

function accountsAsCsv() {
	const header = ['Account', 'Plan', 'Revenue', 'Growth', 'Status'];
	const rows = visibleAccounts().map((account) =>
		[account.name, account.plan, account.revenue, account.growth, account.status].join(','),
	);
	return [header.join(','), ...rows].join('\\n');
}

function downloadAccountsCsv() {
	const file = new Blob([accountsAsCsv()], { type: 'text/csv' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(file);
	link.download = 'accounts-' + dashboardState.range + '.csv';
	link.click();
	URL.revokeObjectURL(link.href);
}

for (const option of rangeOptions)
	option.addEventListener('click', () => selectRange(option.dataset.range));

for (const button of sortButtons)
	button.addEventListener('click', () => selectSortColumn(button.dataset.column));

accountFilter.addEventListener('input', () => {
	dashboardState.filterTerm = accountFilter.value;
	renderAccounts();
});

exportButton.addEventListener('click', downloadAccountsCsv);

renderDashboard();
`;

    const readme = `# Revenue dashboard

Operations dashboard that reads a local dataset and renders key metrics, a revenue chart and an account table.

## Files

- index.html: page structure
- styles/tokens.css: colors, spacing and typography tokens
- styles/app.css: layout and components
- scripts/format.js: number formatting
- scripts/data.js: dataset
- scripts/chart.js: SVG chart rendering
- scripts/app.js: state, rendering and events

## Interactions

- Reporting range switches the metrics and the chart window
- Table headers sort the accounts
- The filter field narrows the accounts by name, plan or status
- Export CSV downloads the accounts currently visible
`;

    root.SynapseSampleProject = Object.freeze({
        name: 'revenue-dashboard',
        files: Object.freeze(
          [
            { path: 'index.html', content: indexHtml },
            { path: 'styles/tokens.css', content: tokensCss },
            { path: 'styles/app.css', content: appCss },
            { path: 'scripts/format.js', content: formatScript },
            { path: 'scripts/data.js', content: dataScript },
            { path: 'scripts/chart.js', content: chartScript },
            { path: 'scripts/app.js', content: appScript },
            { path: 'README.md', content: readme },
          ].map((file) => Object.freeze(file)),
        ),
    });
})(globalThis);
