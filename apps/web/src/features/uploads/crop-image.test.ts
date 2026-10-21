import { cropImage } from './crop-image';

/** jsdom loads no pictures: a stand-in that "loads" as soon as it gets a source. */
class FakeImage extends EventTarget {
  static fails = false;
  naturalWidth = 1200;
  naturalHeight = 400;
  #src = '';
  get src() {
    return this.#src;
  }
  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => this.dispatchEvent(new Event(FakeImage.fails ? 'error' : 'load')));
  }
}

const drawImage = vi.fn();
const context = { drawImage, imageSmoothingQuality: 'low' };

beforeEach(() => {
  FakeImage.fails = false;
  drawImage.mockClear();
  context.imageSmoothingQuality = 'low';
  vi.stubGlobal('Image', FakeImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- jsdom draws nothing; the helper only needs these two members
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
  ) {
    callback(new Blob([`${this.width}x${this.height}`], { type: type ?? 'image/png' }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cropImage', () => {
  it('draws the framed area scaled down to the output and keeps a JPEG a JPEG', async () => {
    const file = await cropImage(
      'blob:picture',
      { x: 100, y: 50, width: 3600, height: 1200 },
      { width: 1800, height: 600 },
      { name: 'holiday.jpeg', type: 'image/jpeg' },
    );

    expect(drawImage).toHaveBeenCalledWith(
      expect.any(FakeImage),
      100,
      50,
      3600,
      1200,
      0,
      0,
      1800,
      600,
    );
    expect(context.imageSmoothingQuality).toBe('high');
    expect(file.name).toBe('holiday.jpg');
    expect(file.type).toBe('image/jpeg');
    expect(await file.text()).toBe('1800x600');
  });

  it('never enlarges a small area and turns other formats into PNG', async () => {
    const file = await cropImage(
      'blob:picture',
      { x: 0, y: 0, width: 300, height: 100 },
      { width: 1800, height: 600 },
      { name: 'me.webp', type: 'image/webp' },
    );

    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 300, 100, 0, 0, 300, 100);
    expect(file.name).toBe('me.png');
    expect(file.type).toBe('image/png');
    expect(await file.text()).toBe('300x100');
  });

  it('rejects a picture the browser cannot read', async () => {
    FakeImage.fails = true;
    await expect(
      cropImage(
        'blob:broken',
        { x: 0, y: 0, width: 10, height: 10 },
        { width: 512, height: 512 },
        { name: 'x.png', type: 'image/png' },
      ),
    ).rejects.toThrow('could not be read');
    expect(drawImage).not.toHaveBeenCalled();
  });
});
