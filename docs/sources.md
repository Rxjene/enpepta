# Sources for the seeded case library

Every case in `data/seed/*.json` carries a `source` citation, and uncertain dates are marked `approximate`.

**Please spot-check before relying on them.** These citations were written from general public knowledge of well-known events and publications, and they were **not re-checked against the live web** when they were created (outbound access to those sites was not available). The citations name books, statutes, agency reports and official histories rather than web addresses, so a reader can find them. Web addresses are left blank in the data until they are checked.

Known soft spots:

* Ancient banking dates (about 2000 BC temple storage; Code of Hammurabi, about 1754 BC) are approximate.
* The 1921 "credit boom" case is a judgement about when the number of US banks peaked, and it is marked approximate. It is recorded with hindsight, which matters for the 1925 banking backtest.
* Telephone 1894 (patent expiry boom), telephone 2018 (robocall complaints), and aviation 1981 (crew resource management adoption) are marked approximate.
* The banking library has no cases between 1933 and 2008, which weakens backtests with cutoffs in that range. Adding cases there is the quickest way to improve them.

The same list appears in the app on the Case library page.
