import os
import random
import pandas
import ecdsa
import sha3

MAX_ADDRESS_PER_QUERY = 22300
projectid = ""
def public_address(private_key_str=None):
    if private_key_str is not None:
        import binascii
        _p = private_key_str.lower()
        _p = bytes(_p, 'utf-8')
        _p = binascii.unhexlify(_p)
        priv = ecdsa.SigningKey.from_string(_p, curve=ecdsa.SECP256k1)
    else:
        priv = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)

    pub = priv.get_verifying_key().to_string()
    keccak = sha3.keccak_256()
    keccak.update(pub)
    address = keccak.hexdigest()[24:]
    return address


def create_wallet_from_number(p):
    private_key = hex(p).strip("0x")
    address = public_address(private_key)
    return (address, private_key)


def random_wallet():
    private_key = ""
    i = 0
    for i in range(64):
        n = random.randint(0x0, 0xf)
        if n == 0:
            private_key += "0"
        else:
            private_key += hex(n).strip("0x")
        # if r > 0xf:
        #     print("Error: random bigger than 0xf:" + str(r))
    address = public_address(private_key)
    return address, private_key


def scan_count_wallet():
    count_query = 0
    MIN = 0x1000000000000000000000000000000000000000000000000000000000000000  # len = 64
    # MAX = 115792089237316195423570985008687907852837564279074904382605163141518161494335 # len = 65 = 115792089237316195423570985008687907852837564279074904382605163141518161494335
    # MAX = 115792089237316195423570985008687907852837564279074904382605163141518161481547
    # MAX = 61514547407324228818772085785865451047049679353621549645961841504203849835764
    MAX = 61514547407324228818772085785865451047049679353621549645961841504203848194410
    # print (public_address(hex(MIN).strip("0x"))) # 7b2419e0ee0bd034f7bf24874c12512acac6e21c
    # print (public_address(hex(MAX).strip("0x"))) # 92d48ff5523c9b04aa426191b4bd21e6080f074a

    p = MAX - 1

    wallets = {}
    file_count = open('count.txt', 'w')

    addresses = {}
    while p > MIN:
        try:
            # tạo ví
            (address, private_key) = create_wallet_from_number(p)
            addresses["'" + address + "'"] = private_key
        except:
            ()
        if (len(addresses.values()) > MAX_ADDRESS_PER_QUERY):
            # truy vấn
            sql = "SELECT address, eth_balance FROM `bigquery-public-data.crypto_ethereum.balances` where address in ({}) and eth_balance > 1000000000000000000".format(
                ",".join(addresses.keys()))
            df = pandas.io.gbq.read_gbq(
                sql, project_id='', dialect='standard')
            count_query += 1

            # có dữ liệu trả về
            if len(df.index) > 0:
                walletsGood = {}
                addrs = df.loc[:, "address"]
                for addr in addrs:
                    # addr = "'" + addr + "'"
                    walletsGood[addr] = addresses[addr]
                    open("walletsGood.txt",
                        "a+").write("{},{}\n".format(addr,  addresses[addr]))
                print(walletsGood)
            # reset dữ liệu
            addresses = {}
        p -= 1
        file_count.write("{}, {}\n".format(p, count_query))

def scan_random():
    addresses = {}
    while True:
        try:
            # tạo ví
            (address, private_key) = random_wallet()
            addresses["'" + address + "'"] = private_key
        except:
            ()
        if (len(addresses.values()) > MAX_ADDRESS_PER_QUERY):
            # truy vấn
            sql = "SELECT address, eth_balance FROM `bigquery-public-data.crypto_ethereum.balances` where address in ({}) and eth_balance > 1000000000000000000".format(
                ",".join(addresses.keys()))
            df = pandas.io.gbq.read_gbq(
                sql, project_id=projectid, dialect='standard')
            count_query += 1

            # có dữ liệu trả về
            if len(df.index) > 0:
                walletsGood = {}
                addrs = df.loc[:, "address"]
                for addr in addrs:
                    # addr = "'" + addr + "'"
                    walletsGood[addr] = addresses[addr]
                    open("walletsGood.txt",
                        "a+").write("{},{}\n".format(addr,  addresses[addr]))
                print(walletsGood)
            # reset dữ liệu
            addresses = {}

<<<<<<< HEAD
scan_random()
=======
scan_random()
>>>>>>> cbf2038 (first commit)
