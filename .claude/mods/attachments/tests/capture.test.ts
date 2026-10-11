import { expect, test } from 'claude-code/testing'

import { pendingAttachments, sourcePaths, withSources } from '../hooks/capture'
import { contextAround } from '../hooks/context'
import { droppedPaths } from '../hooks/dropped'

const PNG_DATA = 'iVBORw0KGgoAAAANSUhEUg'
const JPEG_DATA = '/9j/4AAQSkZJRgABAQAAAQABAAD'
const PDF_DATA = 'JVBERi0xLjcKJeLjz9MK'

const text = (value: string) => ({ type: 'text', text: value })
const image = (mediaType: string, data: string) => ({
	type: 'image',
	source: { type: 'base64', media_type: mediaType, data },
})
const pdf = () => ({
	type: 'document',
	source: { type: 'base64', media_type: 'application/pdf', data: PDF_DATA },
})

test('should pair each pasted image with the [Image #n] ref its prompt text carries, in order', () => {
	const pending = pendingAttachments(
		[
			text('Compare [Image #3] with [Image #4]'),
			image('image/png', PNG_DATA),
			image('image/jpeg', JPEG_DATA),
		],
		0
	)

	expect(pending).toEqual([
		{
			kind: 'image',
			mediaType: 'image/png',
			data: PNG_DATA,
			ref: '[Image #3]',
			stem: 'image-3',
			extension: 'png',
			context: 'Compare [Image #3] with [Image #4]',
		},
		{
			kind: 'image',
			mediaType: 'image/jpeg',
			data: JPEG_DATA,
			ref: '[Image #4]',
			stem: 'image-4',
			extension: 'jpg',
			context: 'Compare [Image #3] with [Image #4]',
		},
	])
})

test('should give a document with no inline ref the mod’s own [Attachment #n], numbered after the archive', () => {
	const pending = pendingAttachments(
		[text('Summarise this contract'), pdf()],
		2
	)

	expect(pending).toEqual([
		{
			kind: 'document',
			mediaType: 'application/pdf',
			data: PDF_DATA,
			ref: '[Attachment #3]',
			stem: 'attachment-3',
			extension: 'pdf',
		},
	])
})

test('should find nothing to archive in a prompt of text alone', () => {
	expect(
		pendingAttachments([text('Fix the failing test in auth.ts')], 0)
	).toEqual([])
})

test('should read every source path the engine notes for dropped images', () => {
	expect(
		sourcePaths(
			'[Image: source: /Users/ada/Desktop/Screenshot 2026-10-11 at 17.16.56.png]\n[Image: source: /tmp/diagram.png]'
		)
	).toEqual([
		'/Users/ada/Desktop/Screenshot 2026-10-11 at 17.16.56.png',
		'/tmp/diagram.png',
	])
})

test('should name the newest unnamed images after their source paths and leave earlier pasted images unnamed', () => {
	const items = [
		{ ref: '[Image #1]', kind: 'image' as const },
		{ ref: '[Image #2]', kind: 'image' as const },
		{ ref: '[Attachment #3]', kind: 'document' as const },
	]

	expect(
		withSources(items, [
			'/Users/ada/Desktop/Screenshot 2026-10-11 at 17.16.56.png',
		])
	).toEqual([
		{ ref: '[Image #1]', kind: 'image' },
		{
			ref: '[Image #2]',
			kind: 'image',
			filename: 'Screenshot 2026-10-11 at 17.16.56.png',
		},
		{ ref: '[Attachment #3]', kind: 'document' },
	])
})

for (const [mediaType, extension] of [
	['image/png', 'png'],
	['image/jpeg', 'jpg'],
	['image/gif', 'gif'],
	['image/webp', 'webp'],
	['image/heic', 'heic'],
	['image/avif', 'bin'],
] as const)
	test(`should save a ${mediaType} image as .${extension}`, () => {
		const [pending] = pendingAttachments(
			[text('[Image #1]'), image(mediaType, PNG_DATA)],
			0
		)

		expect(pending?.extension).toBe(extension)
	})

test('should keep a document’s own inline [Document #n] ref', () => {
	const [pending] = pendingAttachments(
		[text('Read [Document #2] first'), pdf()],
		0
	)

	expect(pending).toEqual(
		expect.objectContaining({
			ref: '[Document #2]',
			stem: 'document-2',
			extension: 'pdf',
		})
	)
})

test('should pair refs per kind when one prompt mixes an image and a PDF', () => {
	const pending = pendingAttachments(
		[
			text('The mockup [Image #5] against the spec'),
			pdf(),
			image('image/png', PNG_DATA),
		],
		1
	)

	expect(pending.map((one) => one.ref)).toEqual([
		'[Attachment #2]',
		'[Image #5]',
	])
})

test('should skip an image given by URL, which has no bytes to save', () => {
	const linked = {
		type: 'image',
		source: { type: 'url', url: 'https://example.com/diagram.png' },
	}

	expect(pendingAttachments([text('[Image #1]'), linked], 0)).toEqual([])
})

test('should read a dropped path with its escaped spaces restored, once', () => {
	expect(
		droppedPaths(
			'/Users/ada/Contracts/Master\\ services\\ agreement.pdf and again /Users/ada/Contracts/Master\\ services\\ agreement.pdf'
		)
	).toEqual(['/Users/ada/Contracts/Master services agreement.pdf'])
})

test('should read each of several dropped paths', () => {
	expect(
		droppedPaths(
			'/Users/ada/sites/pdfix/samples/sample-a.pdf\n/Users/ada/notes/todo.md'
		)
	).toEqual([
		'/Users/ada/sites/pdfix/samples/sample-a.pdf',
		'/Users/ada/notes/todo.md',
	])
})

test('should not read a relative path or a URL as a dropped file', () => {
	expect(
		droppedPaths(
			'see src/hooks/register.tsx or https://example.com/sample-a.pdf'
		)
	).toEqual([])
})

test('should quote whole words up to 60 characters either side of a ref, marking the cuts', () => {
	const prompt =
		'Also, the image overflows its border, they should scale the same, see: [Image #4]. Also, it looks like there are a lot of lint errors in the new mod, and it seems they were not reported'

	expect(contextAround(prompt, '[Image #4]')).toBe(
		'…overflows its border, they should scale the same, see: [Image #4]. Also, it looks like there are a lot of lint errors in the…'
	)
})

test('should quote a dropped path with its escaped spaces restored', () => {
	expect(
		contextAround(
			'Summarise /Users/ada/Contracts/Master\\ services\\ agreement.pdf for me',
			'/Users/ada/Contracts/Master services agreement.pdf'
		)
	).toBe('Summarise /Users/ada/Contracts/Master services agreement.pdf for me')
})

test('should quote nothing when the prompt was the ref alone', () => {
	expect(contextAround('[Image #1]', '[Image #1]')).toBeUndefined()
})

test('should pair new images with the newest refs when the prompt also mentions an earlier one', () => {
	const pending = pendingAttachments(
		[
			text(
				'Compare [Image #6] with what `[Image #5]` showed, and [Image #7] too'
			),
			image('image/png', PNG_DATA),
			image('image/png', PNG_DATA),
		],
		0
	)

	expect(pending.map((one) => one.ref)).toEqual(['[Image #6]', '[Image #7]'])
})

test('should not take a ref the ref button inserted for an earlier image as a new image’s ref', () => {
	const pending = pendingAttachments(
		[
			text(
				'Like [Image #4] (/Users/ada/.claude/attachments/session-123/image-4-d0b5d374.png) but [Image #1]'
			),
			image('image/png', PNG_DATA),
		],
		0
	)

	expect(pending.map((one) => one.ref)).toEqual(['[Image #1]'])
})

test('should name the newest unnamed image after the last source path when there are more paths than images', () => {
	const items = [{ ref: '[Image #2]', kind: 'image' as const }]

	expect(
		withSources(items, [
			'/Users/ada/Desktop/old.png',
			'/Users/ada/Desktop/new.png',
		])
	).toEqual([{ ref: '[Image #2]', kind: 'image', filename: 'new.png' }])
})

test('should read a path in parentheses or quotes without the punctuation around it', () => {
	expect(
		droppedPaths(
			"see (/Users/ada/a.pdf), '/Users/ada/b.pdf' and /Users/ada/c.pdf."
		)
	).toEqual(['/Users/ada/a.pdf', '/Users/ada/b.pdf', '/Users/ada/c.pdf'])
})
