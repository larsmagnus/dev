import type { Elements } from 'claude-code'

import type { Rendered } from '../types'

import { fitCells } from './fit'
import type { Diagram } from './segments'

type PictureElements = Pick<Elements['terminal'], 'Box' | 'Image' | 'Client'>

/** A diagram's picture in a frame that lights on hover, with an invisible region over it that opens it on press. */
export function pictureFrame(
	{ Box, Image, Client }: PictureElements,
	diagram: Diagram,
	index: number,
	rendered: Rendered
) {
	const { columns, rows } = fitCells(rendered)

	return (
		<Box
			key={`frame:${index}`}
			alignSelf="flex-start"
			borderStyle="round"
			borderDimColor
			hover={{ borderColor: 'suggestion', borderDimColor: false }}
		>
			<Box position="relative" width={columns} height={rows}>
				<Image
					source={{ file: rendered.file, format: 'png' }}
					columns={columns}
					rows={rows}
					alt={`${diagram.language} diagram`}
				/>
				<Box position="absolute" top={0} left={0}>
					<Client
						key={`open:${diagram.hash}`}
						module="./image-hit.tsx"
						props={{ columns, rows }}
						width={columns}
						height={rows}
					/>
				</Box>
			</Box>
		</Box>
	)
}
