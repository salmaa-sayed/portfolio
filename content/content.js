/* The portfolio's editable source of truth. Paths are relative to the site root.
   Reorder sections/items here. Set enabled: false to hide a section.
   All production videos are local MP4s; source URLs are kept for provenance. */
window.SITE_CONTENT = {
  playback: { autoplay: true, rememberSound: true, pauseOffscreen: true, viewerEnabled: true },
  hero: { name: 'Salmaa Sayed', role: 'Motion designer & video editor', featured: 'XN4P5rIAQjU' },
  contact: { whatsapp: 'https://wa.me/201128051982', phone: 'tel:+201128051982', email: 'mailto:salmasayed2811@gmail.com' },
  sections: [
    {
      id: 'motion', title: 'Motion', description: 'Ideas, brought into motion.', type: 'videos', layout: 'motion', enabled: true,
      items: [
        { id: 'XN4P5rIAQjU', src: 'media/motion/XN4P5rIAQjU.mp4', poster: 'media/posters/XN4P5rIAQjU.jpg', title: 'Americana', subtitle: 'Saudi National Day', format: 'landscape' },
        { id: 'lex8r6LOHu8', src: 'media/motion/lex8r6LOHu8.mp4', poster: 'media/posters/lex8r6LOHu8.jpg', title: 'e&', subtitle: 'Motion design', format: 'landscape', fit: 'contain' },
        { id: '2_83tmPxycc', src: 'media/motion/2_83tmPxycc.mp4', poster: 'media/posters/2_83tmPxycc.jpg', title: 'e&', subtitle: 'Short-form motion', format: 'portrait', fit: 'contain' },
      ],
    },
    {
      id: 'teasers', title: 'Teasers', description: 'A glimpse. A feeling. A reason to watch.', type: 'videos', layout: 'reels', enabled: true,
      items: [
        { id: 'huGofbtz-b4', src: 'media/teasers/huGofbtz-b4.mp4', poster: 'media/posters/huGofbtz-b4.jpg', title: 'Tuwa', subtitle: 'Brand teaser', format: 'portrait' },
        { id: 'eRFnpAxorso', src: 'media/teasers/eRFnpAxorso.mp4', poster: 'media/posters/eRFnpAxorso.jpg', title: 'UNI-Q', subtitle: 'Men Edition', format: 'portrait' },
        { id: 'WHof-wzP970', src: 'media/teasers/WHof-wzP970.mp4', poster: 'media/posters/WHof-wzP970.jpg', title: 'UNI-Q', subtitle: 'Women Edition', format: 'portrait' },
        { id: 'dBLbzSQgc6I', src: 'media/teasers/dBLbzSQgc6I.mp4', poster: 'media/posters/dBLbzSQgc6I.jpg', title: 'Belvris', subtitle: 'Brand teaser', format: 'portrait' },
      ],
    },
    {
      id: 'reels', title: 'Reels & work', description: 'Small screens. Full attention.', type: 'videos', layout: 'reels', enabled: true,
      items: [
        { id: 'KIV_ARPy8aA', src: 'media/reels/KIV_ARPy8aA.mp4', poster: 'media/posters/KIV_ARPy8aA.jpg', title: 'LBC', subtitle: 'Reel 01', format: 'portrait' },
        { id: 'xY_oTtFAGRo', src: 'media/reels/xY_oTtFAGRo.mp4', poster: 'media/posters/xY_oTtFAGRo.jpg', title: 'LBC', subtitle: 'Reel 02', format: 'portrait' },
        { id: 'z68RErUQRPE', src: 'media/reels/z68RErUQRPE.mp4', poster: 'media/posters/z68RErUQRPE.jpg', title: 'LBC', subtitle: 'Reel 03', format: 'portrait' },
        { id: 'USarlIfU78k', src: 'media/reels/USarlIfU78k.mp4', poster: 'media/posters/USarlIfU78k.jpg', title: 'Rejan', subtitle: 'Reel 01', format: 'portrait' },
        { id: 'zvoBdHHm600', src: 'media/reels/zvoBdHHm600.mp4', poster: 'media/posters/zvoBdHHm600.jpg', title: 'Rejan', subtitle: 'Reel 02', format: 'portrait' },
        { id: 'ODt0ao291vc', src: 'media/reels/ODt0ao291vc.mp4', poster: 'media/posters/ODt0ao291vc.jpg', title: 'Makan', subtitle: 'Brand reel', format: 'portrait' },
        { id: 'RtL4B8awR8s', src: 'media/reels/RtL4B8awR8s.mp4', poster: 'media/posters/RtL4B8awR8s.jpg', title: 'Tuwa', subtitle: 'Brand reel', format: 'portrait' },
        { id: 'VVMzcErR5yo', src: 'media/reels/VVMzcErR5yo.mp4', poster: 'media/posters/VVMzcErR5yo.jpg', title: 'Iconic', subtitle: 'Reel 01', format: 'portrait' },
        { id: 'ttAh6XKlP6E', src: 'media/reels/ttAh6XKlP6E.mp4', poster: 'media/posters/ttAh6XKlP6E.jpg', title: 'Iconic', subtitle: 'Reel 02', format: 'landscape', fit: 'contain' },
        { id: 'c5hBQKr6CWo', src: 'media/reels/c5hBQKr6CWo.mp4', poster: 'media/posters/c5hBQKr6CWo.jpg', title: 'Iconic', subtitle: 'Reel 03', format: 'portrait' },
        { id: '_WOKJZZFybs', src: 'media/reels/_WOKJZZFybs.mp4', poster: 'media/posters/_WOKJZZFybs.jpg', title: 'Hers Gym', subtitle: 'Brand reel', format: 'portrait' },
      ],
    },
  ],
};
