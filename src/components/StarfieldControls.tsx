// src/components/StarfieldControls.tsx
'use client';

import React from 'react';
import {
	Box, VStack, HStack, IconButton, Text, FormControl, FormLabel,
	Slider, SliderTrack, SliderFilledTrack, SliderThumb,
	Switch, Collapse, Button, Divider, useDisclosure, Icon, Select, Badge, Tooltip,
} from '@chakra-ui/react';
import { FaTimes, FaCog, FaRocket, FaTachometerAlt, FaStar, FaCloud, FaSyncAlt, FaCircle, FaMapMarkerAlt } from 'react-icons/fa';
import type { IconType } from 'react-icons';
import { useStarfield, useStarfieldStats, QualitySetting } from '@/contexts/StarfieldContext';
import { useToken } from '@chakra-ui/react';

interface SliderControl {
	type: 'slider';
	key: string;
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (value: number) => string;
	onChange: (value: number) => void;
	hint?: string;
}

interface SwitchControl {
	type: 'switch';
	key: string;
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
	hint?: string;
}

interface SelectControl {
	type: 'select';
	key: string;
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (value: string) => void;
	hint?: string;
}

type Control = SliderControl | SwitchControl | SelectControl;

interface ControlSection {
	title: string;
	icon: IconType;
	controls: Control[];
}

const QUALITY_OPTIONS: { value: QualitySetting; label: string }[] = [
	{ value: 'auto', label: 'Auto (adapts to this device)' },
	{ value: 'ultra', label: 'Ultra — ~250k stars' },
	{ value: 'high', label: 'High — ~150k stars' },
	{ value: 'medium', label: 'Medium — ~85k stars' },
	{ value: 'low', label: 'Low — ~37k stars, 30 fps' },
	{ value: 'minimal', label: 'Minimal — ~13k stars, 30 fps' },
];

const fixed = (digits: number, suffix = '') => (value: number) => `${value.toFixed(digits)}${suffix}`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

const StarfieldControls: React.FC = () => {
	const { config, updateConfig, updateLayer, updateBlackHoleConfig, resetConfig } = useStarfield();
	const { stats } = useStarfieldStats();
	const { isOpen, onToggle } = useDisclosure();

	const [accentRgba, textPrimaryToken, textSecondaryToken, bgCardToken, borderToken] = useToken('colors', [
		'accent.500',
		'neutral.light.text-primary',
		'neutral.light.text-secondary',
		'neutral.light.bg-card',
		'neutral.light.border-color',
	]);

	const glassCardProps = {
		bg: bgCardToken,
		backdropFilter: 'blur(12px) saturate(160%)',
		border: '1px solid',
		borderColor: borderToken,
		boxShadow: 'md',
		borderRadius: 'xl',
	} as const;

	const statusLine =
		stats.mode === 'loading'
			? 'Charting the galaxy…'
			: stats.mode === 'static'
				? 'Static galaxy (WebGL unavailable)'
				: `${stats.mode.toUpperCase()} · ${stats.fps} fps · ${stats.stars.toLocaleString()} stars`;

	const sections: ControlSection[] = [
		{
			title: 'Performance',
			icon: FaTachometerAlt,
			controls: [
				{
					type: 'select',
					key: 'quality',
					label: 'Quality',
					value: config.quality,
					options: QUALITY_OPTIONS,
					onChange: (value) => updateConfig('quality', value as QualitySetting),
					hint: 'Auto picks a tier from your GPU, memory and CPU, then adjusts live to hold a smooth frame rate.',
				},
				{
					type: 'slider',
					key: 'starDensity',
					label: 'Star Density',
					value: config.starDensity,
					min: 0.1,
					max: 1,
					step: 0.05,
					format: percent,
					onChange: (value) => updateConfig('starDensity', value),
					hint: 'Share of the tier’s stars to draw — a random subset of the same galaxy.',
				},
				{
					type: 'switch',
					key: 'showStats',
					label: 'Show Performance Overlay',
					value: config.showStats,
					onChange: (value) => updateConfig('showStats', value),
				},
			],
		},
		{
			title: 'Stars',
			icon: FaStar,
			controls: [
				{ type: 'slider', key: 'brightness', label: 'Brightness', value: config.brightness, min: 0.3, max: 2, step: 0.05, format: fixed(2, '×'), onChange: (value) => updateConfig('brightness', value) },
				{ type: 'slider', key: 'starSize', label: 'Star Size', value: config.starSize, min: 0.5, max: 2.5, step: 0.05, format: fixed(2, '×'), onChange: (value) => updateConfig('starSize', value) },
				{ type: 'switch', key: 'twinkle', label: 'Twinkle', value: config.twinkle, onChange: (value) => updateConfig('twinkle', value), hint: 'Disabled automatically on Low/Minimal tiers.' },
			],
		},
		{
			title: 'Galaxy Layers',
			icon: FaCloud,
			controls: [
				{ type: 'slider', key: 'glowIntensity', label: 'Core & Disk Glow', value: config.glowIntensity, min: 0, max: 2, step: 0.05, format: fixed(2, '×'), onChange: (value) => updateConfig('glowIntensity', value) },
				{ type: 'switch', key: 'glow', label: 'Unresolved Starlight', value: config.layers.glow, onChange: (value) => updateLayer('glow', value) },
				{ type: 'switch', key: 'dust', label: 'Dust Lanes', value: config.layers.dust, onChange: (value) => updateLayer('dust', value), hint: 'Not drawn on the Minimal tier.' },
				{ type: 'switch', key: 'nebulae', label: 'Star-Forming Nebulae', value: config.layers.nebulae, onChange: (value) => updateLayer('nebulae', value) },
				{ type: 'switch', key: 'halo', label: 'Halo, Globular Clusters & Magellanic Clouds', value: config.layers.halo, onChange: (value) => updateLayer('halo', value) },
			],
		},
		{
			title: 'Motion & Scroll',
			icon: FaSyncAlt,
			controls: [
				{ type: 'switch', key: 'rotation', label: 'Galactic Rotation', value: config.rotation, onChange: (value) => updateConfig('rotation', value) },
				{
					type: 'slider',
					key: 'orbitMinutes',
					label: 'One Solar Orbit (≈230 Myr) Takes',
					value: config.orbitMinutes,
					min: 1,
					max: 30,
					step: 0.5,
					format: (value) => `${value} min`,
					onChange: (value) => updateConfig('orbitMinutes', value),
				},
				{ type: 'switch', key: 'scrollCamera', label: 'Fly Camera on Scroll', value: config.scrollCamera, onChange: (value) => updateConfig('scrollCamera', value), hint: 'Face-on → tilted → edge-on → home at the Sun.' },
				{ type: 'slider', key: 'scrollRoll', label: 'Scroll Roll', value: config.scrollRoll, min: 0, max: 720, step: 15, format: (value) => `${value}°`, onChange: (value) => updateConfig('scrollRoll', value) },
				{ type: 'slider', key: 'parallax', label: '3D Parallax', value: config.parallax, min: 0, max: 2, step: 0.05, format: fixed(2, '×'), onChange: (value) => updateConfig('parallax', value) },
			],
		},
		{
			title: 'Sagittarius A*',
			icon: FaCircle,
			controls: [
				{ type: 'switch', key: 'bhEnabled', label: 'Show Black Hole', value: config.blackHole.isEnabled, onChange: (value) => updateBlackHoleConfig('isEnabled', value) },
				{ type: 'slider', key: 'bhSize', label: 'Size', value: config.blackHole.size, min: 4, max: 120, step: 1, format: (value) => `${value}px`, onChange: (value) => updateBlackHoleConfig('size', value), hint: 'Exaggerated — at true scale Sgr A* would be far smaller than a pixel.' },
				{ type: 'switch', key: 'bhDisk', label: 'Accretion Disk', value: config.blackHole.accretionDisk, onChange: (value) => updateBlackHoleConfig('accretionDisk', value) },
				{ type: 'slider', key: 'bhSpin', label: 'Disk Spin', value: config.blackHole.spin, min: 0, max: 3, step: 0.05, format: fixed(2, '×'), onChange: (value) => updateBlackHoleConfig('spin', value) },
			],
		},
		{
			title: 'Navigation',
			icon: FaMapMarkerAlt,
			controls: [
				{ type: 'switch', key: 'showSunMarker', label: 'Mark the Sun', value: config.showSunMarker, onChange: (value) => updateConfig('showSunMarker', value) },
			],
		},
	];

	const withHint = (control: Control, label: React.ReactNode) =>
		control.hint ? (
			<Tooltip label={control.hint} placement="top-start" openDelay={300}>
				<Box as="span" cursor="help">{label}</Box>
			</Tooltip>
		) : label;

	const renderControl = (control: Control) => {
		const id = `starfield-${control.key}`;
		switch (control.type) {
			case 'slider':
				return (
					<FormControl key={control.key}>
						<HStack justify="space-between" mb={1}>
							<FormLabel htmlFor={id} color={textPrimaryToken} fontSize="sm" mb={0}>
								{withHint(control, control.label)}
							</FormLabel>
							<Text color={textSecondaryToken} fontSize="sm">{control.format(control.value)}</Text>
						</HStack>
						<Slider
							id={id}
							aria-label={control.label}
							value={control.value}
							min={control.min}
							max={control.max}
							step={control.step}
							onChange={control.onChange}
						>
							<SliderTrack bg="transparent">
								<SliderFilledTrack bg={accentRgba} />
							</SliderTrack>
							<SliderThumb />
						</Slider>
					</FormControl>
				);
			case 'switch':
				return (
					<FormControl key={control.key} display="flex" alignItems="center" justifyContent="space-between">
						<FormLabel htmlFor={id} color={textPrimaryToken} fontSize="sm" mb="0" mr={3}>
							{withHint(control, control.label)}
						</FormLabel>
						<Switch id={id} colorScheme="brand" isChecked={control.value} onChange={(e) => control.onChange(e.target.checked)} />
					</FormControl>
				);
			case 'select':
				return (
					<FormControl key={control.key}>
						<FormLabel htmlFor={id} color={textPrimaryToken} fontSize="sm">
							{withHint(control, control.label)}
						</FormLabel>
						<Select id={id} size="sm" value={control.value} onChange={(e) => control.onChange(e.target.value)} color={textPrimaryToken}>
							{control.options.map((option) => (
								<option key={option.value} value={option.value}>{option.label}</option>
							))}
						</Select>
					</FormControl>
				);
		}
	};

	return (
		<Box
			position="fixed"
			bottom={4}
			right={4}
			zIndex={50}
			p={3}
			width={{ base: 'calc(100vw - 32px)', sm: '340px' }}
			maxW="340px"
			{...glassCardProps}
		>
			<HStack justify="space-between" align="center" mb={isOpen ? 3 : 0}>
				<HStack spacing={2} minW={0}>
					<Icon as={FaRocket} color={accentRgba} />
					<VStack spacing={0} align="start" minW={0}>
						<Text color={textPrimaryToken} fontWeight="bold">Milky Way Controls</Text>
						<Text color={textSecondaryToken} fontSize="xs" noOfLines={1}>{statusLine}</Text>
					</VStack>
				</HStack>
				<IconButton
					aria-label={isOpen ? 'Close controls' : 'Open controls'}
					icon={isOpen ? <FaTimes /> : <FaCog />}
					size="sm"
					variant="ghost"
					color={accentRgba}
					onClick={onToggle}
				/>
			</HStack>

			<Collapse in={isOpen} animateOpacity>
				<VStack spacing={4} align="stretch" maxH="70vh" overflowY="auto" pr={2} mt={2}>
					{stats.mode !== 'loading' && stats.mode !== 'static' && (
						<HStack spacing={2} flexWrap="wrap">
							<Badge colorScheme="purple">Tier: {stats.mode}</Badge>
							<Badge colorScheme="gray">Device max: {stats.ceiling}</Badge>
							{stats.resolution < 1 && <Badge colorScheme="orange">Res {Math.round(stats.resolution * 100)}%</Badge>}
						</HStack>
					)}
					{sections.map((section, index) => (
						<Box key={section.title}>
							<HStack spacing={2} mb={3}>
								<Icon as={section.icon} color={accentRgba} boxSize={3.5} />
								<Text color={accentRgba} fontWeight="bold" fontSize="sm">{section.title}</Text>
							</HStack>
							<VStack spacing={3} align="stretch">
								{section.controls.map(renderControl)}
							</VStack>
							{index < sections.length - 1 && <Divider mt={4} />}
						</Box>
					))}

					<Button colorScheme="brand" size="sm" onClick={resetConfig} mt={2}>
						Reset to Defaults
					</Button>
				</VStack>
			</Collapse>
		</Box>
	);
};

export default StarfieldControls;
