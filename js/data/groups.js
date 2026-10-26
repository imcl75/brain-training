/* Four Groups: the puzzle bank. Original puzzles.
 * Each puzzle is four groups of four. level 0 is the gentlest group, 3 the trickiest.
 * Words are written in lower case here and shown in capitals. Keep each word to
 * 11 characters or fewer so it fits a tile, and every word unique in its puzzle.
 * Every puzzle needs exactly one solution: when a word could fit two groups
 * (a red herring), the other group must already have its four. */
(function () {
  // P([level, name, 'word,word,word,word'], ...) -> { groups: [{ name, words, level }] }
  function P() {
    return { groups: Array.from(arguments).map(([level, name, words]) => ({ name, words: words.split(','), level })) };
  }

  BT.data.groups = [
    P([0, 'Fruit', 'pear,plum,lemon,grape'],
      [1, 'Shades of green', 'lime,olive,sage,jade'],
      [2, 'Card games', 'snap,rummy,whist,patience'],
      [3, '___ cake', 'cup,pan,fish,sponge']),

    P([0, 'Breakfast', 'toast,bacon,porridge,kipper'],
      [1, 'Things with keys', 'piano,map,lock,typewriter'],
      [2, 'Famous bears', 'paddington,rupert,baloo,pooh'],
      [3, 'Hidden numbers', 'often,bone,weight,canine']),

    P([0, 'Garden birds', 'robin,wren,thrush,starling'],
      [1, 'In the toolbox', 'hammer,spanner,pliers,chisel'],
      [2, 'Snooker words', 'cue,break,pocket,cushion'],
      [3, '___ fly', 'butter,dragon,crane,horse']),

    P([0, 'Dog breeds', 'poodle,beagle,boxer,collie'],
      [1, 'Racket sports', 'squash,tennis,badminton,ping pong'],
      [2, 'The marrow family', 'marrow,courgette,pumpkin,cucumber'],
      [3, 'Christmas ___', 'cracker,pudding,carol,stocking']),

    P([0, 'Planets', 'venus,saturn,jupiter,mercury'],
      [1, 'Chocolate bars', 'mars,twix,flake,wispa'],
      [2, 'Metals', 'iron,tin,zinc,lead'],
      [3, 'Sea ___', 'horse,lion,shell,weed']),

    P([0, 'Colours of the rainbow', 'red,orange,indigo,violet'],
      [1, 'Flowers that are girls’ names', 'rose,lily,daisy,poppy'],
      [2, 'Fish', 'salmon,cod,haddock,plaice'],
      [3, '___ cheese', 'cottage,cream,goat,blue']),

    P([0, 'Cold weather', 'snow,sleet,hail,fog'],
      [1, 'Furniture', 'table,chair,sofa,wardrobe'],
      [2, 'British rivers', 'thames,severn,trent,tyne'],
      [3, 'Add a letter at the front to make a body part', 'rain,and,kin,ace']),

    P([0, 'Shakespeare plays', 'macbeth,othello,tempest,lear'],
      [1, 'Places to live', 'city,town,village,hamlet'],
      [2, 'Board games', 'chess,draughts,ludo,backgammon'],
      [3, 'Hidden animals', 'category,ratio,pigment,scowl']),

    P([0, 'Pasta', 'penne,fusilli,lasagne,ravioli'],
      [1, 'Cheeses', 'cheddar,brie,stilton,feta'],
      [2, 'In Somerset', 'wells,bath,taunton,frome'],
      [3, 'Sound like letters', 'tea,sea,why,queue']),

    P([0, 'In the garden', 'shed,lawn,pond,patio'],
      [1, 'Herbs', 'thyme,rosemary,parsley,sage'],
      [2, 'Fawlty Towers characters', 'basil,sybil,polly,manuel'],
      [3, 'Sound like numbers', 'won,ate,fore,too']),

    P([0, 'Orchestra instruments', 'violin,cello,flute,trumpet'],
      [1, 'Parts of a ship', 'deck,hull,stern,bow'],
      [2, 'Wrapping a present', 'ribbon,paper,tag,tape'],
      [3, 'Anagrams of each other', 'post,spot,pots,stop']),

    P([0, 'Kitchen utensils', 'whisk,ladle,spatula,sieve'],
      [1, 'Sweets', 'fudge,toffee,humbug,nougat'],
      [2, 'Dickens characters', 'scrooge,fagin,pip,havisham'],
      [3, 'Nonsense!', 'tosh,codswallop,balderdash,poppycock']),

    P([0, 'European countries', 'france,spain,italy,greece'],
      [1, 'Christmas dinner', 'turkey,sprouts,stuffing,gravy'],
      [2, 'Musicals', 'cats,evita,oliver,annie'],
      [3, 'Sound like countries', 'grease,chilly,wails,check']),

    P([0, 'Joints of the body', 'knee,elbow,ankle,wrist'],
      [1, 'Shoes', 'brogue,loafer,sandal,slipper'],
      [2, 'Lazy people', 'idler,slacker,layabout,sluggard'],
      [3, '___ cap', 'night,ice,toe,swim']),

    P([0, 'Trees', 'oak,elm,beech,birch'],
      [1, 'By the fireside', 'poker,grate,tongs,bellows'],
      [2, 'Volcanoes', 'ash,lava,magma,crater'],
      [3, '___ fish', 'cat,sword,star,jelly']),

    P([0, 'On the farm', 'cow,sheep,goat,hen'],
      [1, 'Baby animals', 'calf,lamb,kid,foal'],
      [2, 'Tease', 'rib,josh,rag,needle'],
      [3, 'Add ‘let’ to make a new word', 'book,out,ham,pig']),

    P([0, 'At the seaside', 'bucket,pier,deckchair,sandcastle'],
      [1, 'Card suits (singular)', 'heart,club,diamond,spade'],
      [2, 'Golf words', 'tee,birdie,bogey,eagle'],
      [3, 'Wedding anniversaries', 'paper,silver,ruby,pearl']),

    P([0, 'Root vegetables', 'carrot,potato,parsnip,turnip'],
      [1, 'Symbols of Wales', 'daffodil,dragon,lovespoon,leek'],
      [2, 'Chess pieces', 'pawn,rook,bishop,knight'],
      [3, 'Spring ___', 'onion,roll,clean,chicken']),

    P([0, 'Clothes', 'shirt,skirt,jumper,blouse'],
      [1, 'Picnic things', 'flask,blanket,hamper,rug'],
      [2, 'Named after noblemen', 'cardigan,sandwich,wellington,raglan'],
      [3, '___ tail', 'pony,pig,dove,fish']),

    P([0, 'Lengths of time', 'week,month,year,decade'],
      [1, 'Very small', 'tiny,wee,teeny,minute'],
      [2, 'At a boxing match', 'second,round,bell,ring'],
      [3, '___ glass', 'hour,wine,eye,looking']),

    P([0, 'Insects', 'bee,wasp,beetle,flea'],
      [1, 'The Beatles', 'john,paul,ringo,george'],
      [2, 'English kings', 'henry,edward,richard,william'],
      [3, '___ hill', 'ant,mole,foot,down']),

    P([0, 'In the sky', 'moon,star,cloud,sun'],
      [1, 'Newspapers', 'times,mirror,guardian,express'],
      [2, 'Things with a face', 'clock,coin,cliff,watch'],
      [3, '___ board', 'skate,key,black,card']),

    P([0, 'Ballroom dances', 'waltz,tango,foxtrot,rumba'],
      [1, 'Phonetic alphabet', 'alpha,bravo,charlie,hotel'],
      [2, 'Parts of a river', 'delta,mouth,source,bed'],
      [3, '___ holiday', 'bank,package,summer,working']),

    P([0, 'Breads', 'bagel,baguette,naan,ciabatta'],
      [1, 'Hats', 'beret,bowler,trilby,fedora'],
      [2, 'Cricket words', 'wicket,crease,over,innings'],
      [3, 'Hidden creepy-crawlies', 'smother,beef,sticker,giant']),

    P([0, 'Puddings', 'trifle,crumble,pavlova,eton mess'],
      [1, 'A small amount', 'smidgen,pinch,iota,dash'],
      [2, 'Hurry', 'race,bolt,hare,rush'],
      [3, 'Put a C in front for a new word', 'lock,hair,rash,lamp']),

    P([0, 'Composers', 'bach,mozart,handel,elgar'],
      [1, 'On a front door', 'handle,hinge,knocker,letterbox'],
      [2, 'Things with pedals', 'piano,bicycle,organ,harp'],
      [3, 'Hidden ‘art’', 'party,start,cartoon,heart']),

    P([0, 'Seafood', 'prawn,lobster,mussel,oyster'],
      [1, 'Star signs', 'leo,aries,virgo,libra'],
      [2, 'In the gym', 'treadmill,rower,dumbbell,kettlebell'],
      [3, '___ shell', 'egg,nut,bomb,sea']),

    P([0, 'Hot and cold drinks', 'coffee,cocoa,squash,juice'],
      [1, 'Football positions', 'keeper,striker,winger,defender'],
      [2, 'Things you strike', 'match,bell,gong,deal'],
      [3, 'Sound like letters', 'tea,pea,bee,you']),

    P([0, 'Jewellery', 'necklace,bracelet,brooch,tiara'],
      [1, 'Using the telephone', 'call,text,ring,dial'],
      [2, 'Parts of a clock', 'hand,face,pendulum,chime'],
      [3, '___ bone', 'back,wish,funny,jaw']),

    P([0, 'Birds of prey', 'kestrel,buzzard,osprey,harrier'],
      [1, 'Toys', 'kite,yo-yo,doll,marbles'],
      [2, 'Famous aircraft', 'spitfire,concorde,hurricane,lancaster'],
      [3, 'Start of rhyming slang', 'apples,plates,trouble,loaf']),

    P([0, 'Parts of a car', 'wheel,engine,bonnet,boot'],
      [1, 'Footwear', 'clog,trainer,slipper,wellie'],
      [2, 'Hats', 'cap,beanie,stetson,panama'],
      [3, 'Hidden fish', 'carpet,fortunate,peeled,solemn']),

    P([0, 'Shapes', 'oval,hexagon,diamond,rectangle'],
      [1, 'In the town centre', 'market,library,church,square'],
      [2, 'Percussion', 'drum,cymbal,tambourine,triangle'],
      [3, 'Inner ___', 'circle,city,tube,ear']),

    P([0, 'Seven dwarfs', 'grumpy,sleepy,bashful,doc'],
      [1, 'Hospital staff', 'nurse,surgeon,matron,physio'],
      [2, '___ hour', 'happy,rush,witching,eleventh'],
      [3, '___ pudding', 'rice,bread,black,yorkshire']),

    P([0, 'Bread rolls', 'bap,cob,barm,bun'],
      [1, 'Horses', 'mare,stallion,pony,foal'],
      [2, 'Hairstyles', 'bob,plait,quiff,mullet'],
      [3, 'Male animals', 'drake,ram,boar,gander']),

    P([0, 'Pencil case', 'pen,pencil,rubber,sharpener'],
      [1, 'Rulers', 'emperor,tsar,king,queen'],
      [2, 'Chess pieces', 'rook,bishop,knight,pawn'],
      [3, '___ bee', 'drone,worker,bumble,honey']),

    P([0, 'Biscuits', 'digestive,bourbon,shortbread,garibaldi'],
      [1, 'Kinds of whisky', 'scotch,rye,malt,grain'],
      [2, 'Breads', 'soda,sourdough,brioche,focaccia'],
      [3, 'Scotch ___', 'egg,mist,tape,broth']),

    P([0, 'South American countries', 'chile,argentina,brazil,bolivia'],
      [1, 'Nuts', 'walnut,almond,cashew,pecan'],
      [2, 'Paddington Bear', 'marmalade,duffle coat,suitcase,peru'],
      [3, 'Hidden money', 'compound,neurology,dimension,scent']),

    P([0, 'Gemstones', 'ruby,sapphire,opal,emerald'],
      [1, 'Shades of green', 'lime,mint,sage,bottle'],
      [2, 'Herbs', 'basil,thyme,dill,chive'],
      [3, '___ sauce', 'apple,bread,brown,worcester']),

    P([0, 'Rodents', 'hamster,squirrel,vole,gerbil'],
      [1, 'Computer bits', 'keyboard,monitor,printer,mouse'],
      [2, 'Lizards', 'gecko,iguana,chameleon,skink'],
      [3, '___ race', 'rat,horse,arms,space']),

    P([0, 'Sports', 'golf,rugby,hockey,tennis'],
      [1, 'Public schools', 'eton,harrow,stowe,winchester'],
      [2, 'Farm tools', 'plough,rake,hoe,scythe'],
      [3, 'Ice ___', 'cream,age,rink,cube']),

    P([0, 'Christmas decorations', 'tinsel,bauble,cracker,stocking'],
      [1, 'Fireworks', 'rocket,sparkler,banger,fountain'],
      [2, 'Sausages', 'chipolata,saveloy,frankfurter,cumberland'],
      [3, 'Hidden kinds of music', 'popular,folklore,trapeze,metallic']),

    P([0, 'Cat breeds', 'siamese,persian,burmese,manx'],
      [1, 'Carpets', 'axminster,wilton,shag,berber'],
      [2, 'Isle of ___', 'wight,man,skye,anglesey'],
      [3, '___ house', 'ware,light,green,farm']),

    P([0, 'Fabrics', 'cotton,wool,linen,velvet'],
      [1, 'On the bed', 'duvet,pillow,eiderdown,mattress'],
      [2, '___ worm', 'silk,book,earth,tape'],
      [3, '___ music', 'sheet,folk,chamber,country']),

    P([0, 'Kitchen appliances', 'toaster,oven,fridge,kettle'],
      [1, 'Hot ___', 'dog,pot,potato,seat'],
      [2, 'Seasons', 'spring,summer,autumn,winter'],
      [3, '___ fall', 'night,rain,water,land']),

    P([0, 'At a wedding', 'bride,groom,veil,bouquet'],
      [1, 'Horse tack', 'saddle,bridle,stirrup,halter'],
      [2, 'On top of a cake', 'icing,marzipan,sprinkles,cherry'],
      [3, 'Hidden ‘room’', 'broom,mushroom,bathroom,roomy']),

    P([0, 'Tropical fruit', 'mango,papaya,pineapple,banana'],
      [1, 'Yellow things', 'lemon,canary,custard,daffodil'],
      [2, 'Pet birds', 'budgie,parrot,cockatiel,lovebird'],
      [3, '___ powder', 'baking,curry,talcum,gun']),

    P([0, 'Water', 'lake,ocean,pond,river'],
      [1, 'Ballets', 'swan lake,nutcracker,giselle,coppelia'],
      [2, 'Kitchen gadgets', 'corkscrew,peeler,grater,colander'],
      [3, '___ life', 'sea,wild,night,still']),

    P([0, 'Tools', 'drill,screwdriver,chisel,spanner'],
      [1, 'Past tenses', 'saw,ate,went,flew'],
      [2, 'Athletics throws', 'javelin,discus,shot,hammer'],
      [3, 'Anagrams of LEAST', 'slate,stale,steal,tales']),

    P([0, 'Luggage', 'suitcase,holdall,rucksack,valise'],
      [1, 'Parts of a tree', 'trunk,branch,leaf,bark'],
      [2, 'At the bank', 'account,loan,interest,overdraft'],
      [3, '___ beer', 'root,ginger,craft,draught']),

    P([0, 'Fictional detectives', 'holmes,poirot,marple,rebus'],
      [1, 'Ways to send a signal', 'morse,semaphore,flares,beacon'],
      [2, 'Trousers', 'chinos,jeans,cords,slacks'],
      [3, 'Puzzles', 'sudoku,crossword,jigsaw,wordsearch']),

    P([0, 'Breakfast cereals', 'muesli,granola,cornflakes,bran'],
      [1, 'Time in prison', 'bird,time,stretch,porridge'],
      [2, 'Gym exercises', 'squat,lunge,plank,burpee'],
      [3, '___ machine', 'washing,slot,fruit,sewing']),

    P([0, 'Shades of red', 'scarlet,crimson,cherry,ruby'],
      [1, 'Leave stranded', 'maroon,strand,abandon,desert'],
      [2, 'Tarts', 'bakewell,custard,treacle,jam'],
      [3, 'Hidden vehicles', 'abuse,vanish,cabinet,tramp']),

    P([0, 'Weights', 'ounce,gram,ton,kilo'],
      [1, 'Hit hard', 'pound,thump,batter,pummel'],
      [2, 'Fish supper', 'cod,chips,vinegar,mushy peas'],
      [3, '___ Age', 'stone,ice,iron,bronze']),

    P([0, 'Ways with eggs', 'boiled,fried,scrambled,poached'],
      [1, 'Stolen', 'nicked,pinched,swiped,lifted'],
      [2, 'Confused', 'muddled,baffled,puzzled,flummoxed'],
      [3, 'Hidden body parts', 'harmful,earnest,whipped,machine']),

    P([0, 'Spring flowers', 'tulip,daffodil,crocus,iris'],
      [1, 'Parts of the eye', 'pupil,lens,cornea,retina'],
      [2, 'At school', 'teacher,governor,caretaker,dinner lady'],
      [3, 'The Netherlands', 'windmill,clog,edam,canal']),

    P([0, 'Citrus fruit', 'lemon,orange,grapefruit,satsuma'],
      [1, '___ stone', 'lime,mile,key,sand'],
      [2, 'On a door', 'lock,hinge,handle,knocker'],
      [3, 'Shades of brown', 'beige,taupe,tan,khaki']),

    P([0, 'Pets', 'dog,rabbit,goldfish,hamster'],
      [1, 'Chatter', 'natter,gossip,prattle,waffle'],
      [2, 'Breakfast bakes', 'pancake,crumpet,muffin,kipper'],
      [3, '___ walk', 'cat,board,side,sleep']),

    P([0, 'At the hairdresser', 'fringe,perm,bob,highlights'],
      [1, 'Edges', 'border,rim,verge,margin'],
      [2, 'Old money', 'quid,tanner,florin,guinea'],
      [3, 'Along the road', 'kerb,lane,junction,layby']),

    P([0, 'Swimming strokes', 'crawl,butterfly,backstroke,sidestroke'],
      [1, 'Move quietly', 'sneak,tiptoe,slink,prowl'],
      [2, 'Things with wings', 'plane,angel,bat,dragon'],
      [3, 'Cricket words', 'stump,bail,crease,wicket']),

    P([0, 'On your face', 'chin,cheek,brow,jaw'],
      [1, 'Impudence', 'sauce,nerve,gall,brass'],
      [2, 'Condiments', 'mustard,ketchup,relish,mayo'],
      [3, '___ bag', 'nose,hand,tea,sleeping']),

    P([0, 'Mountains', 'everest,snowdon,ben nevis,kilimanjaro'],
      [1, 'Climbing gear', 'rope,harness,crampon,ice axe'],
      [2, 'Parts of a cap', 'peak,brim,crown,band'],
      [3, 'Crown ___', 'jewels,court,prince,green']),

    P([0, 'Cocktails', 'martini,mojito,margarita,daiquiri'],
      [1, 'Bond villains', 'blofeld,goldfinger,jaws,oddjob'],
      [2, 'Mouth', 'gob,trap,kisser,cakehole'],
      [3, 'Begin with a metal', 'tinsel,ironic,leadership,silverfish']),

    P([0, 'Board games', 'chess,ludo,draughts,monopoly'],
      [1, 'Business words', 'merger,takeover,cartel,buyout'],
      [2, 'Murder mystery weapons', 'rope,dagger,candlestick,spanner'],
      [3, 'Hidden cooking pots', 'panther,despot,awoken,jugular']),

    P([0, 'Tennis words', 'deuce,love,ace,volley'],
      [1, 'Card table words', 'trump,joker,suit,deck'],
      [2, 'Terms of endearment', 'darling,petal,duck,pet'],
      [3, '___ pot', 'jack,tea,crack,flower']),

    P([0, 'In the bathroom', 'bath,sink,mirror,towel'],
      [1, 'English cities', 'york,leeds,durham,chester'],
      [2, '___ rail', 'hand,guard,curtain,picture'],
      [3, 'Rhyme with THINK', 'wink,mink,blink,pink']),

    P([0, 'Parts of a book', 'page,cover,spine,chapter'],
      [1, 'Insurance words', 'policy,premium,claim,excess'],
      [2, 'Prickly things', 'hedgehog,cactus,holly,thistle'],
      [3, '___ mark', 'book,birth,land,trade']),

    P([0, 'Months', 'march,may,june,august'],
      [1, 'Ways to walk', 'stride,trudge,plod,amble'],
      [2, 'Little helping verbs', 'can,will,shall,must'],
      [3, 'Majestic', 'noble,grand,stately,regal']),

    P([0, 'Takeaway food', 'burger,pizza,kebab,hot dog'],
      [1, 'Dog commands', 'sit,stay,heel,fetch'],
      [2, 'Parts of a shoe', 'sole,lace,eyelet,upper'],
      [3, 'Mother ___', 'nature,ship,hen,tongue']),

    P([0, 'Sandwich fillings', 'ham,tuna,egg,cress'],
      [1, 'Things you crack', 'code,joke,safe,whip'],
      [2, 'In Parliament', 'speaker,chancellor,minister,backbencher'],
      [3, '___ board', 'cheese,key,dart,skirting']),

    P([0, 'Garden pests', 'slug,aphid,greenfly,caterpillar'],
      [1, 'Hit', 'punch,smack,clout,wallop'],
      [2, 'Drinks', 'cider,sherry,port,ale'],
      [3, '___ mail', 'snail,black,chain,junk']),

    P([0, 'In a church', 'pew,altar,font,pulpit'],
      [1, 'Styles of text', 'italic,bold,underline,serif'],
      [2, 'Brave', 'daring,plucky,gallant,valiant'],
      [3, 'Rhyme with BLUE', 'stew,crew,glue,view']),

    P([0, 'British wildlife', 'badger,hedgehog,deer,otter'],
      [1, 'Pester', 'nag,hound,harass,bug'],
      [2, 'Dog breeds', 'terrier,spaniel,retriever,whippet'],
      [3, '___ glove', 'fox,kid,oven,boxing']),

    P([0, 'Big cats', 'lion,tiger,leopard,cheetah'],
      [1, 'Striped things', 'badger,skunk,humbug,barcode'],
      [2, 'British road crossings', 'pelican,puffin,toucan,zebra'],
      [3, 'Queen ___', 'mother,consort,size,bee']),

    P([0, 'Spices', 'cinnamon,nutmeg,ginger,paprika'],
      [1, 'Hair colours', 'blonde,auburn,brunette,chestnut'],
      [2, 'Horse colours', 'bay,roan,piebald,palomino'],
      [3, 'Football words', 'offside,header,corner,penalty']),

    P([0, 'Windy weather', 'breeze,gale,storm,hurricane'],
      [1, 'An easy task', 'doddle,cinch,walkover,cakewalk'],
      [2, 'Attack', 'besiege,raid,invade,ambush'],
      [3, 'Rhyme with PINCH', 'finch,winch,clinch,flinch']),

    P([0, 'Huge', 'colossal,gigantic,enormous,massive'],
      [1, 'Extinct animals', 'dodo,mammoth,mastodon,great auk'],
      [2, 'Famous ships', 'titanic,mary rose,cutty sark,golden hind'],
      [3, 'Winning', 'triumph,success,conquest,victory']),

    P([0, 'At the pub', 'pint,darts,bar,jukebox'],
      [1, 'Liquid measures', 'gallon,litre,quart,gill'],
      [2, 'Gold', 'ingot,nugget,bullion,leaf'],
      [3, 'Hidden ‘art’', 'tartan,quartet,charter,depart']),

    P([0, 'Full English', 'bacon,beans,toast,kipper'],
      [1, 'Voices in a choir', 'alto,tenor,bass,soprano'],
      [2, 'Tell tales', 'blab,squeal,grass,sing'],
      [3, 'Hidden herbs', 'sausage,basilica,archive,cruel']),

    P([0, 'Measures of length', 'mile,metre,foot,furlong'],
      [1, 'Parts of the leg', 'knee,shin,thigh,calf'],
      [2, 'Move slowly', 'crawl,creep,dawdle,inch'],
      [3, '___ stick', 'yard,lip,joy,drum']),

    P([0, 'Cakes', 'eccles,battenberg,madeira,dundee'],
      [1, 'Wines', 'port,sherry,claret,rioja'],
      [2, 'Scottish cities', 'glasgow,aberdeen,perth,stirling'],
      [3, 'Australian cities', 'sydney,darwin,hobart,adelaide']),

    P([0, 'Garden birds', 'blackbird,sparrow,magpie,blue tit'],
      [1, 'Jack ___', 'frost,russell,pot,knife'],
      [2, 'Damp weather', 'fog,mist,drizzle,hail'],
      [3, 'Hidden puddings', 'foolish,startle,flannel,piety']),

    P([0, 'Accessories', 'scarf,glove,tie,brooch'],
      [1, 'Nobody wins', 'draw,stalemate,deadlock,dead heat'],
      [2, 'Eat greedily', 'wolf,gobble,guzzle,devour'],
      [3, 'Black ___', 'belt,board,sheep,pudding']),

    P([0, 'Stone fruit', 'cherry,peach,apricot,damson'],
      [1, 'A lovely person', 'gem,treasure,diamond,darling'],
      [2, '___ pudding', 'plum,rice,bread,black'],
      [3, '___ fish', 'cat,jelly,sword,star']),

    P([0, 'Garden tools', 'rake,hoe,trowel,shears'],
      [1, 'Rogues', 'rascal,scoundrel,cad,bounder'],
      [2, 'Sheep farming', 'fleece,ewe,crook,dip'],
      [3, 'Hidden ‘ewe’', 'jewel,sewer,fewer,brewery']),

    P([0, 'In a wallet', 'card,cash,receipt,photo'],
      [1, 'Christmas ___', 'tree,pudding,carol,cracker'],
      [2, 'Songs', 'hymn,ballad,anthem,ditty'],
      [3, 'Hidden ‘ash’', 'fashion,splash,washing,dashboard']),

    P([0, 'At the bakery', 'loaf,bun,roll,scone'],
      [1, 'Take it easy', 'laze,lounge,idle,veg'],
      [2, 'Lists', 'register,inventory,roster,catalogue'],
      [3, 'Hidden pets', 'doggerel,ratio,fishery,scatter']),

    P([0, 'Toiletries', 'soap,shampoo,toothpaste,deodorant'],
      [1, 'Kinds of TV programme', 'sitcom,quiz,documentary,drama'],
      [2, '___ opera', 'space,grand,light,comic'],
      [3, 'Hidden male animals', 'aboard,stagger,bulletin,cobweb']),

    P([0, 'Instruments', 'piano,guitar,drum,harp'],
      [1, 'Flying machines', 'jet,glider,airship,biplane'],
      [2, 'Country walks', 'hike,trek,yomp,stroll'],
      [3, 'Go on and on', 'drone,ramble,witter,babble']),

    P([0, 'London landmarks', 'big ben,the shard,london eye,gherkin'],
      [1, 'Pickled', 'onion,beetroot,egg,cabbage'],
      [2, 'Easter ___', 'bunny,sunday,bonnet,parade'],
      [3, 'Things with an eye', 'needle,potato,storm,peacock']),

    P([0, 'Containers', 'jar,tin,box,bag'],
      [1, 'Metals', 'iron,zinc,copper,nickel'],
      [2, 'Unsettle', 'jolt,rattle,shake,unnerve'],
      [3, 'Board game tokens', 'boot,dog,top hat,thimble']),
  ];
})();
