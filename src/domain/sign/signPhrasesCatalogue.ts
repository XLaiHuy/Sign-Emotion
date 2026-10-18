import type { SignAsset } from './signAsset';

export interface SignPhraseItem {
  id: string;
  text: string;
  signClass?: string;
  category: 'communication' | 'health' | 'daily';
  source: string;
  status: 'planned' | 'source-data' | 'playable';
  sourceDataId?: string;
  asset?: SignAsset;
}

/** 100 authentic Vietnamese Sign Language (VSL) real-human video phrases from ViSignLanguage-Video dataset (PTIT AI Challenge, CC-BY-4.0). */
export const signPhrases100Catalogue: readonly SignPhraseItem[] = [
  {
    "id": "SENT064",
    "text": "Xin viết ra giấy giúp tôi.",
    "signClass": "Giúp",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Giúp, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Giúp/110644.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT033.mp4",
      "sha256": "c665637fe90cbb7edfe40b5a94d314d0d23fb237b80c7b9fce7883b383225c8d",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Giúp)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT001",
    "text": "Tôi muốn đăng ký khám sức khỏe.",
    "signClass": "Bệnh viện",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bệnh viện, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bệnh viện/132938.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT011.mp4",
      "sha256": "4b7cccaff5609c9990e8bc98957e76bd5785247e2aec0d065ec013952e705343",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bệnh viện)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT002",
    "text": "An ủi bạn.",
    "signClass": "An ủi",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: An ủi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/An ủi/126225.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT001.mp4",
      "sha256": "c882b8a4cb94c9e542fc543510c4ef1d1d3760572a139019c7c6fcd1dd91a8a5",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: An ủi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT003",
    "text": "Bác sĩ tên là gì ạ.",
    "signClass": "Bệnh nhân",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bệnh nhân, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bệnh nhân/107540.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT010.mp4",
      "sha256": "68efd2796dac01d66ece6eaed2c2cc24d6ed00087ad284ae544dfeb87a7eb25c",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bệnh nhân)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT004",
    "text": "Ban ngày.",
    "signClass": "Ban ngày",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ban ngày, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ban ngày/112038.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT002.mp4",
      "sha256": "251ca0794f01dd83fa3ae0b6bfe4e1891bae93ab3951b744a79ad7cbdf487ab1",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ban ngày)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT005",
    "text": "Ban đêm.",
    "signClass": "Ban đêm",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ban đêm, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ban đêm/379786.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT003.mp4",
      "sha256": "8e55b9fbfb9ce7e554ccc292242f3f63c3e0466f48f8c6b6d02ecc13c7b9a641",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ban đêm)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT006",
    "text": "Tôi biết rồi.",
    "signClass": "Biết",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Biết, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Biết/102260.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT004.mp4",
      "sha256": "1213192fd6fdd8022baeea7d25b4e93cc1ebb2db5b36445f4ff656726712f138",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Biết)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT007",
    "text": "Biếu tặng quà.",
    "signClass": "Biếu tặng",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Biếu tặng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Biếu tặng/152578.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT005.mp4",
      "sha256": "a3f54ee0b933a2bfe46ebf6f2269613e8862ab5c3a1a14cf696a993cd7fa01f6",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Biếu tặng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT008",
    "text": "Bàn tay.",
    "signClass": "Bàn tay",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bàn tay, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bàn tay/216970.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT006.mp4",
      "sha256": "b96ce63a9f733999d35449e138c4b7ae0740892afeb278fcbdd524f8b0407485",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bàn tay)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT009",
    "text": "Tôi băn khoăn.",
    "signClass": "Băn khoăn",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Băn khoăn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Băn khoăn/100599.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT007.mp4",
      "sha256": "584b5299d09dddb492274e374f5ffc0523308cb9dba5eda9d8c7ffff7f965564",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Băn khoăn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT010",
    "text": "Bạn thân của tôi.",
    "signClass": "Bạn thân",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bạn thân, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bạn thân/172574.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT008.mp4",
      "sha256": "b07b1962e0d53f2426632f817a3e22434a949efd17aa5eec4e995e506b34bd99",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bạn thân)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT011",
    "text": "Bế mạc hội nghị.",
    "signClass": "Bế mạc",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bế mạc, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bế mạc/122056.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT009.mp4",
      "sha256": "d01f08ad0cf692580e4af1864117e035d63eb8bbd2a3824c8eb5fcf5bd1307b3",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bế mạc)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT012",
    "text": "Khuyến cáo của Bộ Y tế.",
    "signClass": "Bộ y tế",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Bộ y tế, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Bộ y tế/141672.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT012.mp4",
      "sha256": "895e097498365c2a946faba9c7d548893d4c4340338c33fe51dd51b50760ddff",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Bộ y tế)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT013",
    "text": "Hẹn gặp buổi chiều.",
    "signClass": "Chiều",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chiều, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chiều/181247.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT013.mp4",
      "sha256": "56c88e81edbd43ec6614ebdce6d0ca2e4bcef89e1c624b0731e169f6fdb503cc",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chiều)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT014",
    "text": "Cho tôi xin.",
    "signClass": "Cho",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cho, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cho/106182.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT014.mp4",
      "sha256": "a27b7d95efc3b2c47abdd13bffbb6aae1802c408b42531d40029c2dcb4bc2f5a",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cho)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT015",
    "text": "Xin chào bạn.",
    "signClass": "Chào",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chào, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chào/124813.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT015.mp4",
      "sha256": "bdb5593c18b8e3169f53d65d28d55882edb7e651f7f84183d1dada713ae14f11",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chào)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT016",
    "text": "Bị đau chân.",
    "signClass": "Chân",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chân, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chân/101773.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT016.mp4",
      "sha256": "1e4da4396d3f6758a77773273be222187c1190f1790e771b7d12853db31289cc",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chân)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT017",
    "text": "Tất cả chúng ta.",
    "signClass": "Chúng ta",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chúng ta, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chúng ta/331251.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT017.mp4",
      "sha256": "2d97f99c2876f6c5287bd98d39d2c514e6c8e2f7b4b52c43538de1d449816367",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chúng ta)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT018",
    "text": "Chạy bộ tập thể dục.",
    "signClass": "Chạy",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chạy, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chạy/100425.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT018.mp4",
      "sha256": "f3504c07e6086df8538e31dfd39076f62685c2add53f96b3d833967d62f6f7fd",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chạy)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT019",
    "text": "Tôi chấp nhận.",
    "signClass": "Chấp nhận",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chấp nhận, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chấp nhận/230679.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT019.mp4",
      "sha256": "02611e7a74c1bd2dc22c4f1b66473f660800fe4467ed5a206183713375df4fb1",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chấp nhận)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT020",
    "text": "Xin nói chậm lại giúp tôi.",
    "signClass": "Chậm lại",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Chậm lại, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Chậm lại/105814.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT020.mp4",
      "sha256": "2328017cd88e957c71ef6fe2729a646c16066573c3a0352c004b373e4fe6a335",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Chậm lại)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT021",
    "text": "Con gấu.",
    "signClass": "Con gấu",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Con gấu, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Con gấu/128276.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT021.mp4",
      "sha256": "a09d3c34137ea3b58cb4ecdce25e5a5a938a000f2d528ad3722e36309ed5a6f0",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Con gấu)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT022",
    "text": "Con cá.",
    "signClass": "Cá",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cá, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cá/109767.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT022.mp4",
      "sha256": "a4713e9dabd8f727939f23cda28408953c320c8180fe5dc3c1acf3381b7c9f1f",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cá)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT023",
    "text": "Thực hiện cách ly.",
    "signClass": "Cách ly",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cách ly, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cách ly/108203.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT023.mp4",
      "sha256": "45a2971421560e521250a854d9373d841f3f514f88fa4eca1c1b5dc71c224416",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cách ly)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT024",
    "text": "Cám dỗ.",
    "signClass": "Cám dỗ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cám dỗ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cám dỗ/103717.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT024.mp4",
      "sha256": "4bff4ffc2da0fec3a9c581175c039acd5a152670b20a064dbe93662f3ffed199",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cám dỗ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT025",
    "text": "Có thể làm được.",
    "signClass": "Có thể",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Có thể, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Có thể/120324.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT025.mp4",
      "sha256": "b8353f4cac99e743776d08c69bd9c161cf1696391c2b5eb602d92d0facca1b04",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Có thể)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT026",
    "text": "Khám toàn bộ cơ thể.",
    "signClass": "Cơ thể",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cơ thể, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cơ thể/132537.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT026.mp4",
      "sha256": "124fc7913f3f795451b6469a87c64bd178af61081c5dc0ebb010ef6116bb5cc1",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cơ thể)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT027",
    "text": "Cảm ơn bạn rất nhiều.",
    "signClass": "Cảm ơn",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cảm ơn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cảm ơn/125990.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT027.mp4",
      "sha256": "9377daab27221090dbef7d4820350ca0b7ceec86b9046d316a8281e76cf08741",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cảm ơn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT028",
    "text": "Tôi cần hỗ trợ.",
    "signClass": "Cần",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cần, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cần/137778.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT028.mp4",
      "sha256": "351d3718b3fa221a9ce59684aeff9b966c7d3032b7405a0999714dc3781d4ed9",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cần)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT029",
    "text": "Cứu tôi với khẩn cấp.",
    "signClass": "Cứu",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Cứu, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Cứu/121369.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT029.mp4",
      "sha256": "0f956d461a3d724127014216a7795cace79105d0d08d295488fa3901ce76c590",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Cứu)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT030",
    "text": "Dạy dỗ học sinh.",
    "signClass": "Dạy dỗ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Dạy dỗ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Dạy dỗ/113266.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT030.mp4",
      "sha256": "425b16bea0a77f6b51d97b0e7cc3a6c3cdf434743b855be1a4196613af351c60",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Dạy dỗ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT031",
    "text": "Rất dễ hiểu.",
    "signClass": "Dễ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Dễ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Dễ/190872.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT031.mp4",
      "sha256": "e5f876a86e1b11f584a4c0be54a2af64b94ad5b7d46a5ead5701f983ab239053",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Dễ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT032",
    "text": "Tôi không thích điều đó.",
    "signClass": "Ghét",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ghét, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ghét/130094.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT032.mp4",
      "sha256": "69c79af738c2133ee880b7989818ebe00359ccec78cfb3a135e9c9598c5a92cb",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ghét)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT034",
    "text": "Tôi bị ho nhiều.",
    "signClass": "Ho",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ho, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ho/114835.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT034.mp4",
      "sha256": "3fdf15924bfb219c55e559de1c20fa15b3511cdddd01f191f4993fd4664e9864",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ho)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT035",
    "text": "Hy sinh cao cả.",
    "signClass": "Hy sinh",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Hy sinh, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Hy sinh/102805.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT035.mp4",
      "sha256": "5574e7c2123ec62c51a3bba073be5fec64a0ea9111649bf4be300697514f57cf",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Hy sinh)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT036",
    "text": "Tôi không hiểu.",
    "signClass": "Nhầm",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nhầm, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nhầm/409478.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT054.mp4",
      "sha256": "09dd4d790f810ee45f5fcc196c1649e434943ce1e22402c24c0ad40382f76f8e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nhầm)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT037",
    "text": "Tôi rất hâm mộ bạn.",
    "signClass": "Hâm mộ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Hâm mộ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Hâm mộ/205409.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT036.mp4",
      "sha256": "837b0bed6882f2962f615df567b4a7ea344b448396a85874ca3a8678a80e6ef8",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Hâm mộ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT038",
    "text": "Hôm nay là ngày mới.",
    "signClass": "Hôm nay",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Hôm nay, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Hôm nay/112861.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT037.mp4",
      "sha256": "e5c8d7b7062a440b9ecec7d4f548e2e0615b7da40f239a80bd4f131d19d6f2f8",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Hôm nay)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT039",
    "text": "Họ là ai?",
    "signClass": "Họ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Họ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Họ/153872.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT038.mp4",
      "sha256": "c205ea6e3019a947d8e981d35955568c82bc661f0bee77232848324c99bf5b6b",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Họ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT040",
    "text": "Học sinh đi học.",
    "signClass": "Học sinh",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Học sinh, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Học sinh/411797.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT039.mp4",
      "sha256": "effae90c93918f979741db8480b2f9e48173a5527a87a692c6148b4c0cd8802e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Học sinh)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT041",
    "text": "Khai báo y tế đầy đủ.",
    "signClass": "Khai báo",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Khai báo, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Khai báo/121753.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT040.mp4",
      "sha256": "79c3aeb5648b9aeb58fd37bd4141340f6d14dff19a7df8589deb8a5aac1d394a",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Khai báo)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT042",
    "text": "Khu vực cách ly an toàn.",
    "signClass": "Khu cách ly",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Khu cách ly, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Khu cách ly/154118.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT041.mp4",
      "sha256": "0460696af4c86439098cc68fa6f0b299d80a7888797210f42f32068b283e9498",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Khu cách ly)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT043",
    "text": "Đừng khóc nữa.",
    "signClass": "Khóc",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Khóc, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Khóc/101206.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT042.mp4",
      "sha256": "e00fb515fb05d6f3503b1eb952f0fe63f161367998700407a224e9d01fc9e83e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Khóc)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT044",
    "text": "Đeo khẩu trang phòng dịch.",
    "signClass": "Khẩu trang",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Khẩu trang, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Khẩu trang/283700.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT043.mp4",
      "sha256": "1dfd841f609931db00dd689c454c755735b563e24699354db0f6a86621425e90",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Khẩu trang)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT045",
    "text": "Kết hôn lập gia đình.",
    "signClass": "Kết hôn",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Kết hôn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Kết hôn/162535.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT044.mp4",
      "sha256": "a05d9b53ab8efe837a618c44eb4646584d2f3d07d657f13139ab32757b4d7ea6",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Kết hôn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT046",
    "text": "Tôi thấy lo lắng.",
    "signClass": "Lo lắng",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Lo lắng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Lo lắng/355570.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT045.mp4",
      "sha256": "ce509df4157449cd18a534e55260083a8bb6260e216121f395768182dd01486e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Lo lắng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT047",
    "text": "Nguy cơ lây bệnh.",
    "signClass": "Lây bệnh",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Lây bệnh, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Lây bệnh/114338.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT046.mp4",
      "sha256": "629b7e53800212bae0970e7dffbb53aab8b9e43b8c64eccd20e1823af7273df7",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Lây bệnh)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT048",
    "text": "Mua thuốc và thức ăn.",
    "signClass": "Mua",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Mua, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Mua/138817.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT047.mp4",
      "sha256": "1029810c89e41db8faa9773f2272a5da7f6ac1af85cb530229c7e26f637beb21",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Mua)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT049",
    "text": "Mời bạn vào trong.",
    "signClass": "Mời vào",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Mời vào, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Mời vào/102689.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT048.mp4",
      "sha256": "6a6edd97505d5c3318f966b786b85bb61f37e4fb16c381e4753e7e07d6247f36",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Mời vào)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT050",
    "text": "Tôi không nghe được.",
    "signClass": "Nghe",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nghe, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nghe/130353.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT049.mp4",
      "sha256": "fd9c144bbced3c234afbcd5613bb344c5a77aaae15e87282567b60b13d6beb07",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nghe)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT051",
    "text": "Nghỉ ngơi dưỡng bệnh.",
    "signClass": "Nghỉ ngơi",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nghỉ ngơi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nghỉ ngơi/108491.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT050.mp4",
      "sha256": "e43ae0d569019c12651f0aae1d2bc75c513c7e175147f918c83d89dce9374ad1",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nghỉ ngơi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT052",
    "text": "Đau ngón tay.",
    "signClass": "Ngón tay",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ngón tay, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ngón tay/151426.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT051.mp4",
      "sha256": "28aba79bdb11b582f6862ef82693922abf1cc453a2c46d9e61afa56cfefd4fa7",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ngón tay)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT053",
    "text": "Về nhà nghỉ ngơi.",
    "signClass": "Nhà",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nhà, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nhà/134985.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT052.mp4",
      "sha256": "2b53c7a7249a8d74fd9cea6825c3317e592062c95be9a60defa8df166a9467d8",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nhà)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT054",
    "text": "Hãy nhìn vào đây.",
    "signClass": "Nhìn",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nhìn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nhìn/114594.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT053.mp4",
      "sha256": "ced7593440ae85549e7a8bc14bbe9c5b6ec8f23cc99d52ac908d0a84450b5fb4",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nhìn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT055",
    "text": "Tôi nhớ lời dặn rồi.",
    "signClass": "Nhớ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nhớ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nhớ/139019.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT055.mp4",
      "sha256": "3329ffbae01f6310d535c0a110e02c9bbb09fb910be19d639b1057ba42313f9b",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nhớ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT056",
    "text": "Nói chuyện trực tiếp.",
    "signClass": "Nói",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nói, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nói/134305.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT056.mp4",
      "sha256": "630a004d6ad2a0c304098ee6337c1b8e6a1c233b8d52f920112735fed9ff0a20",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nói)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT057",
    "text": "Không được nói xấu.",
    "signClass": "Nói xấu",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nói xấu, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nói xấu/102973.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT057.mp4",
      "sha256": "471e57dbad6d279920df3e851b4893f614852347b29160ce266e0a08d0545624",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nói xấu)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT058",
    "text": "Tôi bị buồn nôn và nôn ói.",
    "signClass": "Nôn ói",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nôn ói, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nôn ói/116547.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT058.mp4",
      "sha256": "824a8b3bae6b33e2e9e3be77e60592b34c29d4d4e0dbe773219a06a68a7a6920",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nôn ói)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT059",
    "text": "Vật này rất nặng.",
    "signClass": "Nặng",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Nặng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Nặng/116093.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT059.mp4",
      "sha256": "9ec8d24df6d863017dafc52d2a774b6e9e8a3d998d29854c7ef6cdc2c1d06e82",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Nặng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT060",
    "text": "Ở ngay phía sau.",
    "signClass": "Phía sau",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Phía sau, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Phía sau/153945.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT060.mp4",
      "sha256": "5d4142e25c14275bf3ad86e44a1b2a0fe0c331fc50b4b5be6866dc8d6e080aa0",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Phía sau)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT061",
    "text": "Bị xử phạt vi phạm.",
    "signClass": "Phạt",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Phạt, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Phạt/199704.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT061.mp4",
      "sha256": "1c306c2ccc77125a14798833b727262d04247226f4c433bf8735bb1a6e724b4b",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Phạt)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT062",
    "text": "Tham gia phỏng vấn.",
    "signClass": "Phỏng vấn",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Phỏng vấn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Phỏng vấn/127529.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT062.mp4",
      "sha256": "3f0255f60cf4cbf5d995bfaa9d24b507d89dc966a27bb24b168db4e856cbfb7a",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Phỏng vấn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT063",
    "text": "Khám phục hồi chức năng.",
    "signClass": "Phục hồi",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Phục hồi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Phục hồi/106402.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT063.mp4",
      "sha256": "4d38b8c3b61181ca3d68b2694792d88b62d359dc67c2f6ddfa4e25564cbe5d25",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Phục hồi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT065",
    "text": "Ăn nhiều rau củ quả.",
    "signClass": "Rau",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Rau, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Rau/132146.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT064.mp4",
      "sha256": "334eee22e2408694a90d96e6ebc639386c8060c7e996953baf160c1ce4c39730",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Rau)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT066",
    "text": "Rẽ sang bên phải.",
    "signClass": "Rẽ phải",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Rẽ phải, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Rẽ phải/108060.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT065.mp4",
      "sha256": "dd3eeb8aeaa3a6cd63f93c0becc31dfc6e1173c734342d8a9d5a38f0a33f94db",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Rẽ phải)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT067",
    "text": "Rẽ sang bên trái.",
    "signClass": "Rẽ trái",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Rẽ trái, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Rẽ trái/108105.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT066.mp4",
      "sha256": "a3212716be824a8a49766be3b6ece4af0170b43c2b378b698c9b82562ade3077",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Rẽ trái)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT068",
    "text": "San sẻ yêu thương.",
    "signClass": "San sẻ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: San sẻ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/San sẻ/180089.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT067.mp4",
      "sha256": "db7e5aaa403c6daf380b510ae445bb3c4c0ac416638e1922ed4771c21a89840d",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: San sẻ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT069",
    "text": "Tôi bị sốt cao.",
    "signClass": "Sốt",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Sốt, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Sốt/466346.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT068.mp4",
      "sha256": "4448b196b5d889d108601546a3dd3a75ed84ab71d8975fac9735efd6642e8485",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Sốt)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT070",
    "text": "Hướng dẫn sử dụng.",
    "signClass": "Sử dụng",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Sử dụng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Sử dụng/158900.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT069.mp4",
      "sha256": "cc9641e90e9acce483a488333760ea83bc23a9f044d0afb775b53bbc24d990e2",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Sử dụng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT071",
    "text": "Tôi rất thích.",
    "signClass": "Thích",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thích, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thích/141043.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT070.mp4",
      "sha256": "c06644845b3071bf540b568319efa940eb484d3baeec50c77f917789523de38e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thích)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT072",
    "text": "Đi thăm người ốm.",
    "signClass": "Thăm",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thăm, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thăm/164879.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT071.mp4",
      "sha256": "018e11ab39358003e4fffc700691d9ad0ada084e5291e6226eb08fd28c37b72d",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thăm)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT073",
    "text": "Yêu thương đồng cảm.",
    "signClass": "Thương",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thương, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thương/266457.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT072.mp4",
      "sha256": "9d7f0128c99b80a92e182386c35e99bb43de863a4a138efde2cfa45d65ab94de",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thương)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT074",
    "text": "Bị thất lạc hành lý.",
    "signClass": "Thất lạc",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thất lạc, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thất lạc/143015.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT073.mp4",
      "sha256": "8447cddd6bd3f130cf0aff16531ff453eff309cb58ad6afa7d8c1cf06a3cd897",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thất lạc)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT075",
    "text": "Thức dậy buổi sáng sớm.",
    "signClass": "Thức dậy",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thức dậy, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thức dậy/119116.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT074.mp4",
      "sha256": "54fbaf62c118f926ba1ad70c911e74b0037ea41abc200161d0c5f8f564ec8a42",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thức dậy)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT076",
    "text": "Chuẩn bị thức ăn sạch.",
    "signClass": "Thức ăn",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Thức ăn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Thức ăn/154909.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT075.mp4",
      "sha256": "dcae2dd6808a5161e9fe2620c1e8b141e02b86e8c5dafe5f24647d96b76f0342",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Thức ăn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT077",
    "text": "Nghỉ trưa ăn cơm.",
    "signClass": "Trưa",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Trưa, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Trưa/127965.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT076.mp4",
      "sha256": "efad2ccec47c2be18b5f4bc71069ed092a3f2c75c89449ee5c537f1100eedea9",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Trưa)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT078",
    "text": "Trường học của em.",
    "signClass": "Trường học",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Trường học, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Trường học/105506.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT077.mp4",
      "sha256": "d71775bd0bf399d359c3cd5c2cab411badd614d8a5bbb4fbe8c977b38716eff9",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Trường học)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT079",
    "text": "Tôi là bệnh nhân.",
    "signClass": "Tôi",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Tôi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Tôi/145814.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT078.mp4",
      "sha256": "8dbc0ab3b1e007ad90646f2928c0780c0fa6f2a90cddfd0ea1f9f471824578a1",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Tôi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT080",
    "text": "Tập luyện thể thao đều đặn.",
    "signClass": "Tập luyện",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Tập luyện, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Tập luyện/139434.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT079.mp4",
      "sha256": "678d157dbd545481b35df999616d7cca0a4108175a4d4a63055fe1b71d185988",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Tập luyện)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT081",
    "text": "Buổi tối an lành.",
    "signClass": "Tối",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Tối, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Tối/245121.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT080.mp4",
      "sha256": "ff34fe2cbbc8ac49003e51d5440ddb25eaf7b12946f72b73a4ce7706cb798d86",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Tối)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT082",
    "text": "Uống thuốc đúng giờ.",
    "signClass": "Uống",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Uống, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Uống/101640.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT081.mp4",
      "sha256": "a04bfa3f59cbaa16f8d5354149e12bcb453187ec3054adf00a054c80df3b1a15",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Uống)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT083",
    "text": "Phòng ngừa virus truyền nhiễm.",
    "signClass": "Virus",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Virus, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Virus/365971.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT082.mp4",
      "sha256": "5c502f4ed35b042a6d247737088df6b483b8c1ac75afa34ac66db3179c1be487",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Virus)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT084",
    "text": "Vâng lời bác sĩ.",
    "signClass": "Vâng lời",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Vâng lời, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Vâng lời/121322.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT083.mp4",
      "sha256": "32711fe35ae634a9671c3c96068457d73b7f2593dcafa635b764f2d3784ebe44",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Vâng lời)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT085",
    "text": "Đường đi rất xa.",
    "signClass": "Xa",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xa, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xa/117031.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT084.mp4",
      "sha256": "7fb140831f26238107302c08404769cb06225ae8d8edb571c7ad579697bc7a00",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xa)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT086",
    "text": "Đi xe máy cẩn thận.",
    "signClass": "Xe máy",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xe máy, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xe máy/143941.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT085.mp4",
      "sha256": "bb018bf705f925fc4d1b5bda4b838d1c99e0cfba06f14b5dcf11a7027376568b",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xe máy)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT087",
    "text": "Đi xe đạp rèn luyện.",
    "signClass": "Xe đạp",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xe đạp, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xe đạp/138399.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT086.mp4",
      "sha256": "fa272f345f1697fef02139d1b88e9557458f0cdb77a4f26b060189e5bc0c5852",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xe đạp)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT088",
    "text": "Tôi thành thật xin lỗi.",
    "signClass": "Xin lỗi",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xin lỗi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xin lỗi/230521.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT087.mp4",
      "sha256": "42e933b9dc9fcf563682449c744d9e2e520773834e53e538e3b80d68be50a6e7",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xin lỗi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT089",
    "text": "Xin phép được ra ngoài.",
    "signClass": "Xin phép",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xin phép, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xin phép/182760.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT088.mp4",
      "sha256": "fce3d42a75505bc385d7050041ba7ec395bbf73c02d90a2d755ba2c28b66b22e",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xin phép)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT090",
    "text": "Hôm nay được xuất viện về nhà.",
    "signClass": "Xuất viện",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xuất viện, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xuất viện/132653.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT089.mp4",
      "sha256": "51737f837221e8046bfa9963038da0000d91a9fcab9987843804a5a12a74a5c4",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xuất viện)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT091",
    "text": "Tôi rất xúc động.",
    "signClass": "Xúc động",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Xúc động, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Xúc động/127172.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT090.mp4",
      "sha256": "810442e44ed205454156b69231e022c9b440f452ee9579f16108e842b0e3b88d",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Xúc động)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT092",
    "text": "Áp dụng biện pháp mới.",
    "signClass": "Áp dụng",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Áp dụng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Áp dụng/106814.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT091.mp4",
      "sha256": "834c3e6994c0711d8aab7a4c4374c6a48e5a2ecc5c0595f8eaffb9f8041568ee",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Áp dụng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT093",
    "text": "Đi bằng xe ô tô.",
    "signClass": "Ô tô",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ô tô, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ô tô/132663.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT092.mp4",
      "sha256": "f19675e4d77d15ac1b24b06344f71c8872b7c1119a93a36c3fd44d548d894e13",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ô tô)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT094",
    "text": "Ăn uống đầy đủ chất dinh dưỡng.",
    "signClass": "Ăn",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ăn, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ăn/148050.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT093.mp4",
      "sha256": "a5249ccf055d2502ad8f95a95e10664ac77535cecb2c33510772a5372bb6d990",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ăn)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT095",
    "text": "Ăn mừng chiến thắng.",
    "signClass": "Ăn mừng",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ăn mừng, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ăn mừng/133659.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT094.mp4",
      "sha256": "f756b2f03d9e7537cbe0b11b3a2e147c875bc8848715ca9bb53b59d3d7704626",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ăn mừng)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT096",
    "text": "Đi đứng cẩn thận.",
    "signClass": "Đi",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Đi, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Đi/129751.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT095.mp4",
      "sha256": "e0da7ab79a3fa9b0e31cc3b8bb23f10a56b4711e8b2ac92e5e814017ec4c4f7b",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Đi)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT097",
    "text": "Nhà vệ sinh ở đâu ạ?",
    "signClass": "Đâu",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Đâu, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Đâu/168093.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT096.mp4",
      "sha256": "65dae8c43b17ba1c08e127bc4cc92f44c3af019d8715dc9ec784ce1f244ee8c4",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Đâu)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT098",
    "text": "Tôi bị đau nhức đầu.",
    "signClass": "Đầu",
    "category": "health",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Đầu, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Đầu/127560.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT097.mp4",
      "sha256": "ae6cc6037dce0e1702b6a592a50be444131e4e144d6998c69f44cd7ee7656e62",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Đầu)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT099",
    "text": "Cảnh vật rất đẹp.",
    "signClass": "Đẹp",
    "category": "daily",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Đẹp, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Đẹp/158104.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT098.mp4",
      "sha256": "ba281bb10e3474f784009db75b1e97f9e4b2b097740f4efb036038b3448045ce",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Đẹp)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT100",
    "text": "Tôi hoàn toàn đồng ý.",
    "signClass": "Đồng ý",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Đồng ý, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Đồng ý/131757.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT099.mp4",
      "sha256": "98f31e92141dc604b5e78d57dc203ecddc50fb19e55106371778c6049c8ccc4a",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Đồng ý)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  },
  {
    "id": "SENT101",
    "text": "Tôi nhiệt tình ủng hộ.",
    "signClass": "Ủng hộ",
    "category": "communication",
    "source": "ViSignLanguage-Video (PTIT AI Challenge: Ủng hộ, CC-BY-4.0)",
    "status": "playable",
    "sourceDataId": "dataset/train/Ủng hộ/631971.mp4",
    "asset": {
      "kind": "video",
      "url": "/signs/SENT100.mp4",
      "sha256": "9934525b2ec75b3640652fded9a0c04e288810801b0b165d97e55a832ce86d84",
      "source": "ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: Ủng hộ)",
      "license": "CC-BY-4.0",
      "selfChecked": true,
      "technicalVerified": true
    }
  }
];
