

Welcome to the WEB Crochet Tracker.

This is a simple tool that shouldn't raise safety concerns as it saves progress in YOUR browser

It was written with the aid of AI.

Tested on Brave (Chromium Browser) and Firefox.

# features overview 
- two themes (upper right toggle): "midnight" and "grey scale"
- multiple projects, edit them, delete them
- auto saving in your browser
- ability to export and import progress
- track your projects, even complex ones, easily
- auto-expand rows written like "Round 1-10:"
- add information (for example "Head:" or "White:") to the pattern 
- add colors to stitches
- use US/UK/ES/... terminology for stitches (to work with Chinese some change should be made to the parser)


# licence 
You can do anything you want with this code, but you cannot use it for commercial purposes.


# usage
## new project
### basics
The basic usage consists in selecting a name and pasting a pattern (see syntax)

I'm going to use this
```

R1: (5sc, 1dec)x6 [36]
R2: 36sc [36]
R3: (2sc, 1dec, 2sc)x6 [30]
R4: (3sc, 1dec)x6 [24]
R5: (1sc, 1dec, 1sc)x6 [18]
R6: (1sc, 1dec)x6 [12]
R7: 6dec [6]
```

![1.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/1.jpg)


After hitting save the new project will appear below, under "My Projects"

1. ![2.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/2.jpg)
From here

- you can track it or modify it (by clicking on the name)
- you can export your progress (by clicking on the first icon)
- you can delete it (by clicking on the X)
  
#### tracking / modifying
Click on the name

![3.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/3.jpg)

Now you can:
- edit the name
- edit the pattern 
- go back
- track your progress

**To track** your project click on one of the rows

![4.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/4.jpg)

You can move between rows by using < and >, you can use + or - to track your counts


If you go back, your progress will be saved

### export and import
If you want to export your progress

![5.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/5.jpg)
![6.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/6.jpg)


If you want to import your progress

![7.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/7.jpg)


### other stuff: named sections and colors

#### named sections
Let's say we are working on a "Head" and the whole thing is going to be white


![8.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/8.jpg)

Now, what happens if we track it? A "reminder" appears above

![9.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/9.jpg)


**You can use multiple**
Let's add "Neck:"


![10.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/10.jpg)


![11.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/11.jpg)

##### color
In the toolbar you can see some colors.

Let's say that we have the 6th row
`R6: (1sc, 1dec)x6 [12]`
 We want to remember that the SC is going to be blue, while the Dec is gonna be some other color.

Select 1sc, tap on blue

![12.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/12.jpg)

Let's update it and see how it will look like

![13.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/13.jpg)





# syntax 

## accepted syntax examples
### example 1, simple 
```
Row 1:  5sc [5]
Row 2:  inc, 2sc, inc, 1sc, inc, 2sc, inc, 1sc [10]
Row 3:  7sc, inc, 6sc [15]
Row 4:  dec, 13sc [14]
Row 5:  dec, 1sc, dec, 2sc, dec, 1sc, dec, 2sc [10]
Row 6:  5dec [5]
Row 8:  fasten off
```


You can also use "R:", "Round:" and similar instead of "Row:"

### example 2, Round 1-10:
These will automatically expand in the tracker

```
R1-10: (5sc, 1dec)x6 [36]
```

### example 3, something hairy
```

R1: (5sc, 1dec)x6,
5sc

```

![14.jpg](https://github.com/DiemMasTer/WEB-Crochet-Tracker/blob/main/images/14.jpg)

