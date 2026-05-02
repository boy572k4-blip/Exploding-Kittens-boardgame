export enum Card {
    EXPLODING,
    DEFUSE,
    TACOCAT,
    BEARDCAT,
    RAINBOWCAT,
    POTATOCAT,
    CATTERMELON,
    ATTACK,
    FAVOUR,
    NOPE,
    SHUFFLE,
    SKIP,
    SEETHEFUTURE,
    BACK,

// Imploding Kittens expansion
    IMPLODING,
    REVERSE,
    DRAWFROMBOTTOM,
    FERALCAT,
    ALTERTHEFUTURE,
    TARGETEDATTACK,
}

export const CardNames = new Map<Card, string>([
    [Card.EXPLODING, "Exploding Kitten"],
    [Card.DEFUSE, "Defuse"],
    [Card.TACOCAT, "Tacocat"],
    [Card.BEARDCAT, "Beard Cat"],
    [Card.RAINBOWCAT, "Rainbow Ralphing Cat"],
    [Card.POTATOCAT, "Hairy Potato Cat"],
    [Card.CATTERMELON, "Cattermelon"],
    [Card.ATTACK, "Attack"],
    [Card.FAVOUR, "Favour"],
    [Card.NOPE, "Nope"],
    [Card.SHUFFLE, "Shuffle"],
    [Card.SKIP, "Skip"],
    [Card.SEETHEFUTURE, "See the Future"],
    [Card.BACK, "Card Back Art"],

    [Card.IMPLODING, "Imploding Kitten"],
    [Card.REVERSE, "Reverse"],
    [Card.DRAWFROMBOTTOM, "Draw from the Bottom"],
    [Card.FERALCAT, "Feral Cat"],
    [Card.ALTERTHEFUTURE, "Alter the Future"],
    [Card.TARGETEDATTACK, "Targeted Attack"]
])

export const CardTooltips = new Map<Card, string>([
    [Card.EXPLODING, ""],
    [Card.DEFUSE, "Bảo vệ bạn khỏi Exploding Kitten... một lần duy nhất."],
    [Card.TACOCAT, "Đây là lá Mèo. Chơi 2 lá giống nhau để bốc ngẫu nhiên 1 lá từ tay đối thủ (không nhìn thấy). Chơi 3 lá giống nhau để chỉ định tên lá bài muốn lấy."],
    [Card.BEARDCAT, "Đây là lá Mèo. Chơi 2 lá giống nhau để bốc ngẫu nhiên 1 lá từ tay đối thủ (không nhìn thấy). Chơi 3 lá giống nhau để chỉ định tên lá bài muốn lấy."],
    [Card.RAINBOWCAT, "Đây là lá Mèo. Chơi 2 lá giống nhau để bốc ngẫu nhiên 1 lá từ tay đối thủ (không nhìn thấy). Chơi 3 lá giống nhau để chỉ định tên lá bài muốn lấy."],
    [Card.POTATOCAT, "Đây là lá Mèo. Chơi 2 lá giống nhau để bốc ngẫu nhiên 1 lá từ tay đối thủ (không nhìn thấy). Chơi 3 lá giống nhau để chỉ định tên lá bài muốn lấy."],
    [Card.CATTERMELON, "Đây là lá Mèo. Chơi 2 lá giống nhau để bốc ngẫu nhiên 1 lá từ tay đối thủ (không nhìn thấy). Chơi 3 lá giống nhau để chỉ định tên lá bài muốn lấy."],
    [Card.ATTACK, "Kết thúc lượt mà không rút bài. Người chơi tiếp theo phải chơi 2 lượt."],
    [Card.FAVOUR, "Một người chơi phải đưa cho bạn 1 lá bài do họ chọn."],
    [Card.NOPE, "Ngăn chặn hành động của người chơi khác. Bạn có thể chơi lá này để phản đối."],
    [Card.SHUFFLE, "Xáo trộn bộ bài rút."],
    [Card.SKIP, "Kết thúc lượt mà không rút bài."],
    [Card.SEETHEFUTURE, "Xem riêng 3 lá bài trên cùng của bộ bài rút."],
    [Card.BACK, ""],

    [Card.IMPLODING, ""],
    [Card.REVERSE, "Đảo ngược thứ tự chơi và kết thúc lượt mà không rút bài."],
    [Card.DRAWFROMBOTTOM, "Kết thúc lượt bằng cách rút lá bài dưới cùng của bộ bài."],
    [Card.FERALCAT, "Sử dụng như bất kỳ lá Mèo nào trong combo."],
    [Card.ALTERTHEFUTURE, "Xem riêng và sắp xếp lại 3 lá bài trên cùng của bộ bài rút."],
    [Card.TARGETEDATTACK, "Kết thúc lượt và buộc người chơi bạn chọn phải chơi 2 lượt. Lượt chơi tiếp tục từ người đó."]
])