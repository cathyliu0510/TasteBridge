// A small, hand-curated UI fixture. These tags are not Goodreads data or model output.
export const TAGS = ['Fantasy worlds','Mystery','Relationships','Urban settings','Adventure','Twists','Dark atmosphere','Magic','Historical settings','Coming of age','Literary fiction','Fast paced'];
const b = (id,title,author,year,tags,color,kind) => ({id,title,author,year,tags,color,kind,vector:TAGS.map(t=>tags.includes(t)?1:0)});
export const BOOKS = [
 b('mistborn','Mistborn: The Final Empire','Brandon Sanderson',2006,['Fantasy worlds','Adventure','Twists','Magic','Coming of age','Fast paced'],'#365781','fantasy'),
 b('name-wind','The Name of the Wind','Patrick Rothfuss',2007,['Fantasy worlds','Adventure','Magic','Coming of age','Literary fiction'],'#6b6646','fantasy'),
 b('hobbit','The Hobbit','J. R. R. Tolkien',1937,['Fantasy worlds','Adventure','Coming of age'],'#427060','fantasy'),
 b('earthsea','A Wizard of Earthsea','Ursula K. Le Guin',1968,['Fantasy worlds','Magic','Coming of age','Literary fiction'],'#885944','fantasy'),
 b('magicians','The Magicians','Lev Grossman',2009,['Fantasy worlds','Relationships','Magic','Coming of age','Dark atmosphere'],'#4c6576','fantasy'),
 b('gone-girl','Gone Girl','Gillian Flynn',2012,['Mystery','Relationships','Twists','Dark atmosphere','Fast paced'],'#34353b','mystery'),
 b('girl-train','The Girl on the Train','Paula Hawkins',2015,['Mystery','Relationships','Twists','Dark atmosphere','Fast paced'],'#644746','mystery'),
 b('rebecca','Rebecca','Daphne du Maurier',1938,['Mystery','Relationships','Dark atmosphere','Historical settings','Literary fiction'],'#775771','mystery'),
 b('orient','Murder on the Orient Express','Agatha Christie',1934,['Mystery','Twists','Historical settings','Fast paced'],'#8c6036','mystery'),
 b('sharp','Sharp Objects','Gillian Flynn',2006,['Mystery','Relationships','Dark atmosphere','Fast paced'],'#3d6470','mystery'),
 b('locke','The Lies of Locke Lamora','Scott Lynch',2006,['Fantasy worlds','Urban settings','Adventure','Twists','Relationships','Fast paced'],'#7a4236','bridge'),
 b('neverwhere','Neverwhere','Neil Gaiman',1996,['Fantasy worlds','Mystery','Urban settings','Adventure','Dark atmosphere'],'#394f70','bridge'),
 b('rook','The Rook','Daniel O’Malley',2012,['Fantasy worlds','Mystery','Urban settings','Twists','Dark atmosphere','Fast paced'],'#425d56','bridge'),
 b('city-city','The City & the City','China Miéville',2009,['Fantasy worlds','Mystery','Urban settings','Dark atmosphere','Literary fiction'],'#705953','bridge'),
 b('night-circus','The Night Circus','Erin Morgenstern',2011,['Fantasy worlds','Relationships','Mystery','Magic','Historical settings','Literary fiction'],'#5a4459','bridge'),
 b('shadow-wind','The Shadow of the Wind','Carlos Ruiz Zafón',2001,['Mystery','Relationships','Urban settings','Dark atmosphere','Historical settings','Literary fiction'],'#806942','bridge'),
 b('jonathan','Jonathan Strange & Mr Norrell','Susanna Clarke',2004,['Fantasy worlds','Magic','Historical settings','Literary fiction','Mystery'],'#3d4a52','fantasy'),
 b('american-gods','American Gods','Neil Gaiman',2001,['Fantasy worlds','Adventure','Mystery','Dark atmosphere','Literary fiction'],'#744941','fantasy'),
 b('ninth','The Ninth House','Leigh Bardugo',2019,['Fantasy worlds','Mystery','Magic','Dark atmosphere','Fast paced'],'#292c42','bridge'),
 b('and-then','And Then There Were None','Agatha Christie',1939,['Mystery','Twists','Dark atmosphere','Fast paced'],'#615547','mystery'),
 b('da-vinci','The Da Vinci Code','Dan Brown',2003,['Mystery','Adventure','Twists','Historical settings','Fast paced'],'#7d383c','mystery'),
 b('dresden','Storm Front','Jim Butcher',2000,['Fantasy worlds','Mystery','Urban settings','Magic','Fast paced'],'#3b5d62','bridge'),
 b('six-crows','Six of Crows','Leigh Bardugo',2015,['Fantasy worlds','Relationships','Urban settings','Twists','Fast paced'],'#654a4c','fantasy'),
 b('ocean','The Ocean at the End of the Lane','Neil Gaiman',2013,['Fantasy worlds','Mystery','Coming of age','Literary fiction','Dark atmosphere'],'#49635c','fantasy')
];
// Use only pre-2017 fixtures to mirror the age of the proposal's data. Do not
// interpret inclusion as confirmation of membership in the UCSD catalogue.
export const CATALOG = BOOKS.filter(x=>x.year<=2017);
export const byId = id => CATALOG.find(x=>x.id===id);
export const DEMO = {
 a:['mistborn','name-wind','hobbit','earthsea','magicians'],
 b:['gone-girl','girl-train','rebecca','orient','sharp']
};
