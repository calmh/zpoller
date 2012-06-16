# Zpoller

Zpoller is a new architecture SNMP poller in the RTG tradition. It has the
following distinguishing features:

* User friendly configuration. There is no need to reload or restart for
  configuration and "target making" happens in the background as required.
* Very high performance. A typical installation on a medium sized VM (1GHz CPU,
  512MB RAM) can poll around 10.000 counters per second. 
* Light system resource usage. Threadless design reduces memory needs to the
  minimum necessary, around 60 MB is normal for a setup with 500 hosts and a
  few polling packages.
* No precision degradation. Unless you specifically tell it otherwise,
  *zpoller* will keep data at full precision forever.

# Requirements

* A 64-bit Unix like OS. Linux, Solaris and Mac OS X are tested platforms.
* Node.js version 0.6 or higher.
* MongoDB for data storage. Smaller installations can run the DB on the same
  host as the poller. This is where you need the 64-bitness mentioned above.

# Installation

1. Install (MongoDB)[http://www.mongodb.org/downloads] somewhere suitable. If
   you have no dedicated database host, a default installation on the host that
   will run *zpoller* is fine.
2. Install the latest version of (Node.js)[http://nodejs.org/#download]. The
   easiest is usually to install it from source since distribution packages are
   often out of date. You will need a C++ compiler installed.
3. Install *zpoller* by running *sudo npm install -g zpoller*. 

# Configuration

Configuration consists of three files in the *conf* directory. 

* *general.yml* contains general configuration settings; for example how to
  reach the database.
* *packages.yml* (not to be confused with *package.json* in the root directory)
  contains definitions of "polling packages", i.e. which variables to poll in
  which intervals and so on.
* *hosts.csv* is a list of hosts and their SNMP communities. This is
  deliberately not an YML file in order to make it easier to autogenerate from
  whatever canonical source of host information you might have.

The configuration file samples are well documented and should be
self-explanatory.

When any of these files are changed, or when zpoller is set up for the first
time, they must be imported with the *zconfig* utility. Whenever *zconfig* is
run, it reads the configuration files on disk and updates the configuration
stored in the database.

*zconfig* performs some amount of validation in an attempt to ensure that the
configuration is valid before committing it to the database.

Once the configuration has been imported, it will be picked up by the poller at
the next polling run. If you have added new hosts or polling packages, target
making will happen as needed.

License
-------

2-Clause BSD

